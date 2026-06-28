/**
 * Integration test: full transfer flow
 *
 * Covers the path from TransferService.createTransfer (which maps 1:1 to the
 * POST /transfers endpoint) through to LedgerService.writeJournalEntries
 * (invoked by the outbox consumer after the event is published to RabbitMQ).
 *
 * All I/O touches a real Postgres DB. RabbitMQ is not involved — the consumer
 * step is exercised by calling LedgerService.writeJournalEntries directly,
 * which is exactly what the consumer does with the outbox payload.
 *
 * Run with: pnpm test --testPathPattern=transfer.integration
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { TransferService } from '../transfer.service';
import { TransferRepository } from '../transfer.repository';
import { FxRateService } from '../fx-rate.service';
import { WalletRepository } from '@modules/wallet/wallet.repository';
import { WalletService } from '@modules/wallet/wallet.service';
import { LedgerService } from '@modules/ledger/ledger.service';
import { LedgerRepository } from '@modules/ledger/ledger.repository';
import {
  Currency,
  JournalEntryType,
  OutboxEventType,
  TransferStatus,
} from '@prisma-client';
import { ClsService } from 'nestjs-cls';
import { ConfigModule } from '@nestjs/config';
import { generateAccountNumber } from '@common/utils/account-number.utils';

describe('Transfer — full flow integration (real DB)', () => {
  let transferService: TransferService;
  let ledgerService: LedgerService;
  let prisma: PrismaService;

  let tenantId: string;
  let walletFromId: string;
  let walletToId: string;

  // Closed over by the CLS mock; resolved after beforeAll seeds the tenant.
  let resolvedTenantId = '';

  const cls = {
    get: jest.fn((key: string) => {
      if (key === 'tenantId') return resolvedTenantId;
      return undefined;
    }),
    set: jest.fn(),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      // PrismaService needs ConfigService to read DB_URL from .env
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        PrismaService,
        TransferService,
        TransferRepository,
        FxRateService,
        WalletRepository,
        LedgerRepository,
        LedgerService,
        // WalletService is only needed for getBalance/getJournalEntries on LedgerService.
        // writeJournalEntries does not touch walletService, so a stub suffices.
        { provide: WalletService, useValue: {} },
        { provide: ClsService, useValue: cls },
      ],
    }).compile();

    transferService = module.get(TransferService);
    ledgerService = module.get(LedgerService);
    prisma = module.get(PrismaService);

    // ── Seed ────────────────────────────────────────────────────────────────
    const tenant = await prisma.tenant.create({
      data: { name: `integration-test-${Date.now()}`, apiKeyHash: `hash-${Date.now()}` },
    });
    tenantId = tenant.id;
    resolvedTenantId = tenantId;

    const user = await prisma.user.create({
      data: { tenantId, email: `it-${Date.now()}@test.com`, passwordHash: 'x' },
    });

    // accountNumber is required and unique on Wallet
    const [wFrom, wTo] = await Promise.all([
      prisma.wallet.create({
        data: {
          tenantId,
          userId: user.id,
          currency: Currency.USD,
          accountNumber: generateAccountNumber(tenantId),
        },
      }),
      prisma.wallet.create({
        data: {
          tenantId,
          userId: user.id,
          currency: Currency.USD,
          accountNumber: generateAccountNumber(tenantId),
        },
      }),
    ]);
    walletFromId = wFrom.id;
    walletToId = wTo.id;

    // Seed an opening credit so walletFrom has 200.00 USD (20000 cents).
    const fundTransfer = await prisma.transfer.create({
      data: {
        tenantId,
        walletFromId: walletToId,
        walletToId: walletFromId,
        fromAmount: 20000n,
        toAmount: 20000n,
        fromCurrency: Currency.USD,
        toCurrency: Currency.USD,
        fxRate: '1',
        status: TransferStatus.COMPLETED,
      },
    });
    await prisma.journalEntry.create({
      data: {
        tenantId,
        walletId: walletFromId,
        transferId: fundTransfer.id,
        type: JournalEntryType.CREDIT,
        amount: 20000n,
        currency: Currency.USD,
      },
    });
  });

  afterAll(async () => {
    await prisma.journalEntry.deleteMany({ where: { tenantId } });
    await prisma.outboxEvent.deleteMany({ where: { tenantId } });
    await prisma.transfer.deleteMany({ where: { tenantId } });
    await prisma.wallet.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  // ── happy path ─────────────────────────────────────────────────────────────

  it('step 1 — createTransfer writes Transfer + OutboxEvent; no journal entries yet', async () => {
    const transfer = await transferService.createTransfer({
      walletFromId,
      walletToId,
      amount: 50, // 50.00 USD → 5000 cents
    });

    expect(transfer.id).toBeDefined();
    expect(transfer.status).toBe(TransferStatus.INITIATED);
    expect(transfer.fromAmount).toBe(5000n);
    expect(transfer.toAmount).toBe(5000n);

    // OutboxEvent must exist — guarantees at-least-once delivery to RabbitMQ.
    const outbox = await prisma.outboxEvent.findFirst({
      where: { tenantId, transferId: transfer.id },
    });
    expect(outbox).not.toBeNull();
    expect(outbox!.eventType).toBe(OutboxEventType.TRANSFER_INITIATED);

    // No journal entries yet — those are written by the outbox consumer.
    const journalCount = await prisma.journalEntry.count({
      where: { tenantId, transferId: transfer.id },
    });
    expect(journalCount).toBe(0);
  });

  it('step 2 — writeJournalEntries (simulates consumer) creates a balanced DEBIT+CREDIT pair', async () => {
    // Use a fresh, dedicated transfer so this test is independent of step 1.
    const transfer = await transferService.createTransfer({
      walletFromId,
      walletToId,
      amount: 30, // 30.00 USD → 3000 cents
    });

    const { debit, credit } = await ledgerService.writeJournalEntries({
      transferId: transfer.id,
      debitWalletId: walletFromId,
      creditWalletId: walletToId,
      debitAmount: transfer.fromAmount,
      debitCurrency: Currency.USD,
      creditAmount: transfer.toAmount,
      creditCurrency: Currency.USD,
    });

    expect(debit.type).toBe(JournalEntryType.DEBIT);
    expect(debit.walletId).toBe(walletFromId);
    expect(debit.amount).toBe(3000n);

    expect(credit.type).toBe(JournalEntryType.CREDIT);
    expect(credit.walletId).toBe(walletToId);
    expect(credit.amount).toBe(3000n);

    // Both entries reference the same transfer — double-entry invariant.
    expect(debit.transferId).toBe(transfer.id);
    expect(credit.transferId).toBe(transfer.id);
  });

  it('step 3 — walletFrom balance reflects all debits correctly after settlement', async () => {
    // After seeding 200 USD credit + step-1 50 USD transfer + step-2 30 USD transfer
    // we manually write journals for the step-2 transfer above, but step-1 is unsettled.
    // This test adds journal entries for step-1 too, then verifies the final balance.

    const pendingTransfers = await prisma.transfer.findMany({
      where: { tenantId, walletFromId, status: TransferStatus.INITIATED },
      orderBy: { createdAt: 'asc' },
    });

    // Write journals for all pending transfers (simulating the consumer draining the outbox).
    for (const t of pendingTransfers) {
      const alreadySettled = await prisma.journalEntry.count({
        where: { tenantId, transferId: t.id },
      });
      if (alreadySettled === 0) {
        await ledgerService.writeJournalEntries({
          transferId: t.id,
          debitWalletId: walletFromId,
          creditWalletId: walletToId,
          debitAmount: t.fromAmount,
          debitCurrency: Currency.USD,
          creditAmount: t.toAmount,
          creditCurrency: Currency.USD,
        });
      }
    }

    // Final balance = 200 - 50 - 30 = 120.00 USD = 12000 cents.
    const [credits, debits] = await Promise.all([
      prisma.journalEntry.aggregate({
        where: { tenantId, walletId: walletFromId, type: JournalEntryType.CREDIT },
        _sum: { amount: true },
      }),
      prisma.journalEntry.aggregate({
        where: { tenantId, walletId: walletFromId, type: JournalEntryType.DEBIT },
        _sum: { amount: true },
      }),
    ]);

    const finalBalance =
      ((credits._sum.amount as unknown as bigint) ?? 0n) -
      ((debits._sum.amount as unknown as bigint) ?? 0n);

    expect(finalBalance).toBe(12000n);
  });

  // ── edge cases ─────────────────────────────────────────────────────────────

  it('throws 422 when transfer would overdraw the source wallet', async () => {
    await expect(
      transferService.createTransfer({
        walletFromId,
        walletToId,
        amount: 9999, // far exceeds remaining balance
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('throws 422 when walletFrom does not belong to the tenant', async () => {
    await expect(
      transferService.createTransfer({
        walletFromId: '00000000-0000-0000-0000-000000000000',
        walletToId,
        amount: 1,
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('throws 422 when source and destination wallets are the same', async () => {
    await expect(
      transferService.createTransfer({
        walletFromId,
        walletToId: walletFromId,
        amount: 10,
      }),
    ).rejects.toThrow(
      new UnprocessableEntityException(
        'Source and destination wallets must be different',
      ),
    );
  });

  it('throws 422 when amount is zero', async () => {
    await expect(
      transferService.createTransfer({ walletFromId, walletToId, amount: 0 }),
    ).rejects.toThrow(
      new UnprocessableEntityException(
        'Transfer amount must be greater than zero',
      ),
    );
  });

  it('deduplicates on idempotency key — second call returns 422', async () => {
    const key = `idem-${Date.now()}`;

    await transferService.createTransfer({
      walletFromId,
      walletToId,
      amount: 1,
      idempotencyKey: key,
    });

    await expect(
      transferService.createTransfer({
        walletFromId,
        walletToId,
        amount: 1,
        idempotencyKey: key,
      }),
    ).rejects.toThrow(
      new UnprocessableEntityException('Duplicate idempotency key'),
    );
  });

  it('getTransfer throws 404 for an unknown ID', async () => {
    await expect(
      transferService.getTransfer('00000000-0000-0000-0000-000000000000'),
    ).rejects.toThrow(NotFoundException);
  });
});
