import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ClsService } from 'nestjs-cls';
import { TransferStatus, Currency } from '@prisma-client';
import { ConsumeMessage } from 'amqplib';

import { TransferInitiatedConsumer } from './transfer-initiated.consumer';
import { LedgerService } from '@modules/ledger/ledger.service';
import { PrismaService } from '@common/database/prisma.service';
import {
  RABBITMQ_CHANNEL,
  TRANSFER_EXCHANGE,
  TRANSFER_QUEUE,
} from '@modules/outbox/rabbitmq.constants';
import {
  DLQ_EXCHANGE,
  DLQ_QUEUE,
  MAX_RETRIES,
} from '@modules/outbox/dlq.config';

jest.mock('@modules/outbox/dlq.config', () => ({
  setupDlqTopology: jest.fn().mockResolvedValue(undefined),
  DLQ_EXCHANGE: 'transfer.events.dlq',
  DLQ_QUEUE: 'transfer.initiated.dlq',
  MAX_RETRIES: 3,
  RETRY_DELAY_QUEUES: [
    { name: 'transfer.retry.delay.1', ttl: 1_000 },
    { name: 'transfer.retry.delay.2', ttl: 2_000 },
    { name: 'transfer.retry.delay.3', ttl: 4_000 },
  ],
}));

const TENANT_ID = 'tenant-uuid-1';
const CORRELATION_ID = 'corr-uuid-1';
const TRANSFER_ID = 'transfer-uuid-1';

const makePayload = (overrides = {}) => ({
  transferId: TRANSFER_ID,
  tenantId: TENANT_ID,
  walletFromId: 'wallet-from-1',
  walletToId: 'wallet-to-1',
  fromAmount: '10000',
  toAmount: '10000',
  fromCurrency: Currency.USD,
  toCurrency: Currency.USD,
  fxRate: '1.0',
  ...overrides,
});

const makeMsg = (
  payload: object,
  headers: Record<string, unknown> = {},
): ConsumeMessage =>
  ({
    content: Buffer.from(JSON.stringify(payload)),
    properties: {
      headers: {
        correlationId: CORRELATION_ID,
        tenantId: TENANT_ID,
        ...headers,
      },
    },
  }) as unknown as ConsumeMessage;

describe('TransferInitiatedConsumer', () => {
  let consumer: TransferInitiatedConsumer;
  let ledgerService: jest.Mocked<Pick<LedgerService, 'writeJournalEntries'>>;
  let prisma: { transfer: { update: jest.Mock } };
  let cacheManager: { del: jest.Mock };
  let channel: {
    consume: jest.Mock;
    cancel: jest.Mock;
    ack: jest.Mock;
    publish: jest.Mock;
  };
  let clsService: { runWith: jest.Mock };

  beforeEach(async () => {
    ledgerService = {
      writeJournalEntries: jest
        .fn()
        .mockResolvedValue({ debit: {}, credit: {} }),
    };
    prisma = { transfer: { update: jest.fn().mockResolvedValue({}) } };
    cacheManager = { del: jest.fn().mockResolvedValue(undefined) };
    channel = {
      consume: jest.fn().mockResolvedValue({ consumerTag: 'tag-1' }),
      cancel: jest.fn().mockResolvedValue(undefined),
      ack: jest.fn(),
      publish: jest.fn().mockReturnValue(true),
    };
    clsService = {
      runWith: jest
        .fn()
        .mockImplementation((_store: unknown, fn: () => Promise<unknown>) =>
          fn(),
        ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransferInitiatedConsumer,
        { provide: LedgerService, useValue: ledgerService },
        { provide: PrismaService, useValue: prisma },
        { provide: CACHE_MANAGER, useValue: cacheManager },
        { provide: RABBITMQ_CHANNEL, useValue: channel },
        // ClsService is injected by class token, not a string token
        { provide: ClsService, useValue: clsService },
      ],
    }).compile();

    consumer = module.get(TransferInitiatedConsumer);
    await consumer.onModuleInit();
  });

  afterEach(() => jest.clearAllMocks());

  // ─── happy path ──────────────────────────────────────────────────────────

  describe('successful processing', () => {
    it('writes journal entries, invalidates cache, publishes TRANSFER_COMPLETED, acks message', async () => {
      const msg = makeMsg(makePayload());
      await (consumer as any).handleMessage(msg);

      expect(ledgerService.writeJournalEntries).toHaveBeenCalledWith(
        expect.objectContaining({
          transferId: TRANSFER_ID,
          debitWalletId: 'wallet-from-1',
          creditWalletId: 'wallet-to-1',
          debitAmount: BigInt('10000'),
          creditAmount: BigInt('10000'),
        }),
      );

      expect(prisma.transfer.update).toHaveBeenCalledWith({
        where: { id: TRANSFER_ID },
        data: { status: TransferStatus.COMPLETED },
      });

      expect(cacheManager.del).toHaveBeenCalledWith(
        `wallet:balance:${TENANT_ID}:wallet-from-1`,
      );
      expect(cacheManager.del).toHaveBeenCalledWith(
        `wallet:balance:${TENANT_ID}:wallet-to-1`,
      );

      expect(channel.publish).toHaveBeenCalledWith(
        TRANSFER_EXCHANGE,
        'transfer.completed',
        expect.any(Buffer),
        expect.objectContaining({
          headers: expect.objectContaining({ correlationId: CORRELATION_ID }),
        }),
      );

      expect(channel.ack).toHaveBeenCalledWith(msg);
    });

    it('sets CLS context from message headers before writing entries', async () => {
      const msg = makeMsg(makePayload());
      await (consumer as any).handleMessage(msg);

      expect(clsService.runWith).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          correlationId: CORRELATION_ID,
        }),
        expect.any(Function),
      );
    });
  });

  // ─── malformed message ───────────────────────────────────────────────────

  describe('malformed message', () => {
    it('acks message and routes immediately to DLQ — no retry', async () => {
      const msg = {
        content: Buffer.from('not-valid-json{{{'),
        properties: {
          headers: { correlationId: CORRELATION_ID, tenantId: TENANT_ID },
        },
      } as unknown as ConsumeMessage;

      await (consumer as any).handleMessage(msg);

      expect(channel.ack).toHaveBeenCalledWith(msg);
      expect(channel.publish).toHaveBeenCalledWith(
        DLQ_EXCHANGE,
        DLQ_QUEUE,
        expect.any(Buffer),
        expect.objectContaining({
          headers: expect.objectContaining({ correlationId: CORRELATION_ID }),
        }),
      );
      expect(ledgerService.writeJournalEntries).not.toHaveBeenCalled();
    });
  });

  // ─── retry / DLQ routing ─────────────────────────────────────────────────

  describe('retry routing on processing failure', () => {
    beforeEach(() => {
      ledgerService.writeJournalEntries.mockRejectedValue(
        new Error('DB error'),
      );
    });

    it.each([
      [0, 'transfer.retry.delay.1', 1],
      [1, 'transfer.retry.delay.2', 2],
      [2, 'transfer.retry.delay.3', 3],
    ])(
      'retryCount=%i → publishes to %s with x-retry-count=%i',
      async (retryCount, expectedQueue, expectedNextCount) => {
        const msg = makeMsg(makePayload(), { 'x-retry-count': retryCount });
        await (consumer as any).handleMessage(msg);

        expect(channel.ack).toHaveBeenCalledWith(msg);
        expect(channel.publish).toHaveBeenCalledWith(
          '',
          expectedQueue,
          expect.any(Buffer),
          expect.objectContaining({
            headers: expect.objectContaining({
              'x-retry-count': expectedNextCount,
            }),
          }),
        );
      },
    );

    it(`retryCount=${MAX_RETRIES} → publishes to DLQ, not a retry queue`, async () => {
      const msg = makeMsg(makePayload(), { 'x-retry-count': MAX_RETRIES });
      await (consumer as any).handleMessage(msg);

      expect(channel.ack).toHaveBeenCalledWith(msg);
      expect(channel.publish).toHaveBeenCalledWith(
        DLQ_EXCHANGE,
        DLQ_QUEUE,
        expect.any(Buffer),
        expect.objectContaining({
          headers: expect.objectContaining({ correlationId: CORRELATION_ID }),
        }),
      );
    });
  });

  // ─── null message ────────────────────────────────────────────────────────

  it('does nothing when broker sends null (consumer cancelled)', async () => {
    await (consumer as any).handleMessage(null);
    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.publish).not.toHaveBeenCalled();
  });
});
