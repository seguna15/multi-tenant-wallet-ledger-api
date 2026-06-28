import { Test, TestingModule } from '@nestjs/testing';
import {
  Currency,
  OutboxEventType,
  OutboxStatus,
  TransferStatus,
} from '@prisma-client';
import { PrismaService } from '@common/database/prisma.service';
import { ClsService } from 'nestjs-cls';
import { LedgerRepository } from '@modules/ledger/ledger.repository';
import { TransferRepository } from '../transfer.repository';
import { UnprocessableEntityException } from '@nestjs/common';

const TENANT_ID = 'tenant-a';

const baseInput = {
  walletFromId: 'wallet-from',
  walletToId: 'wallet-to',
  fromAmount: 5000n,
  toAmount: 5000n,
  fromCurrency: Currency.USD,
  toCurrency: Currency.USD,
  fxRate: '1',
};

const mockCreatedTransfer = {
  id: 'transfer-1',
  tenantId: TENANT_ID,
  status: TransferStatus.INITIATED,
  ...baseInput,
};

describe('TransferRepository — createWithOutbox atomicity', () => {
  let repository: TransferRepository;
  let prisma: jest.Mocked<PrismaService>;
  let ledgerRepository: jest.Mocked<LedgerRepository>;

  // Shared mock tx — both writes must use THIS object
  let mockTx: {
    $queryRaw: jest.Mock;
    transfer: { create: jest.Mock; aggregate: jest.Mock };
    outboxEvent: { create: jest.Mock };
  };

  beforeEach(async () => {
    mockTx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      transfer: {
        create: jest.fn().mockResolvedValue(mockCreatedTransfer),
        aggregate: jest.fn().mockResolvedValue({ _sum: { fromAmount: 0n } }),
      },
      outboxEvent: { create: jest.fn().mockResolvedValue({}) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransferRepository,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest
              .fn()
              .mockImplementation((cb: any) => cb(mockTx)),
          },
        },
        {
          provide: ClsService,
          useValue: { get: jest.fn().mockReturnValue(TENANT_ID) },
        },
        {
          provide: LedgerRepository,
          useValue: { computeBalance: jest.fn().mockResolvedValue(10000n) },
        },
      ],
    }).compile();

    repository = module.get(TransferRepository);
    prisma = module.get(PrismaService);
    ledgerRepository = module.get(LedgerRepository);
  });

  afterEach(() => jest.clearAllMocks());

  it('wraps Transfer and OutboxEvent creation in a single transaction', async () => {
    await repository.createWithOutbox(baseInput);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockTx.transfer.create).toHaveBeenCalledTimes(1);
    expect(mockTx.outboxEvent.create).toHaveBeenCalledTimes(1);
  });

  it('creates the OutboxEvent with PENDING status and the correct transferId', async () => {
    await repository.createWithOutbox(baseInput);

    expect(mockTx.outboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          transferId: mockCreatedTransfer.id,
          status: OutboxStatus.PENDING,
          eventType: OutboxEventType.TRANSFER_INITIATED,
          tenantId: TENANT_ID,
        }),
      }),
    );
  });

  it('rolls back both records when outboxEvent.create throws inside the transaction', async () => {
    // Prisma's $transaction propagates the thrown error — neither write commits
    mockTx.outboxEvent.create.mockRejectedValue(new Error('db constraint'));
    prisma.$transaction.mockImplementation(async (cb: any) => {
      await cb(mockTx); // will throw
    });

    await expect(repository.createWithOutbox(baseInput)).rejects.toThrow(
      'db constraint',
    );
    expect(mockTx.transfer.create).toHaveBeenCalledTimes(1);
    expect(mockTx.outboxEvent.create).toHaveBeenCalledTimes(1);
  });

  it('throws 422 and skips both writes when balance is insufficient', async () => {
    ledgerRepository.computeBalance.mockResolvedValue(100n); // below fromAmount

    await expect(repository.createWithOutbox(baseInput)).rejects.toThrow(
      UnprocessableEntityException,
    );

    expect(mockTx.transfer.create).not.toHaveBeenCalled();
    expect(mockTx.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('throws 422 when other in-flight transfers have already reserved the remaining balance', async () => {
    // Posted balance covers this transfer on its own (10000 >= 5000), but
    // another INITIATED transfer from this wallet has already reserved 6000
    // of it (debit not yet posted), leaving only 4000 available.
    mockTx.transfer.aggregate.mockResolvedValue({ _sum: { fromAmount: 6000n } });

    await expect(repository.createWithOutbox(baseInput)).rejects.toThrow(
      UnprocessableEntityException,
    );

    // Note: the ClsService mock returns TENANT_ID for every key, including
    // 'isGlobalAdmin', so withTenant() short-circuits and returns `where` as-is.
    expect(mockTx.transfer.aggregate).toHaveBeenCalledWith({
      where: {
        walletFromId: baseInput.walletFromId,
        status: { in: [TransferStatus.INITIATED, TransferStatus.PROCESSING] },
      },
      _sum: { fromAmount: true },
    });
    expect(mockTx.transfer.create).not.toHaveBeenCalled();
    expect(mockTx.outboxEvent.create).not.toHaveBeenCalled();
  });
});
