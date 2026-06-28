import { Test, TestingModule } from '@nestjs/testing';
import { UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { TransferService } from '../transfer.service';
import { TransferRepository } from '../transfer.repository';
import { FxRateService } from '../fx-rate.service';
import { WalletRepository } from '@modules/wallet/wallet.repository';
import { WalletService } from '@modules/wallet/wallet.service';
import { LedgerService } from '@modules/ledger/ledger.service';
import { LedgerRepository } from '@modules/ledger/ledger.repository';
import { Currency, JournalEntryType, TransferStatus } from '@prisma-client';
import { ClsService } from 'nestjs-cls';
import { ConfigModule } from '@nestjs/config';
import { generateAccountNumber } from '@common/utils/account-number.utils';

describe('TransferService — concurrent stress test (integration)', () => {
  let service: TransferService;
  let prisma: PrismaService;
  let tenantId: string;
  let walletFromId: string;
  let walletToId: string;

  const cls = {
    get: jest.fn((key: string) => {
      if (key === 'tenantId') return tenantId;
      return undefined;
    }),
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
        LedgerService,
        LedgerRepository,
        { provide: ClsService, useValue: cls },
        // LedgerService has a circular dep on WalletService; we only call writeJournalEntries
        // (which never touches walletService), so a no-op stub is safe here.
        { provide: WalletService, useValue: {} },
      ],
    }).compile();

    service = module.get(TransferService);
    prisma = module.get(PrismaService);

    // Seed: tenant + two wallets + opening credit of 100.00 USD on walletFrom
    const tenant = await prisma.tenant.create({
      data: { name: 'stress-test', apiKeyHash: `hash-${Date.now()}` },
    });
    tenantId = tenant.id;

    const user = await prisma.user.create({
      data: {
        tenantId,
        email: `stress-${Date.now()}@test.com`,
        passwordHash: 'x',
      },
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

    // Seed a funding transfer so walletFrom has 100.00 USD (10000 cents)
    const fundTransfer = await prisma.transfer.create({
      data: {
        tenantId,
        walletFromId: walletToId,
        walletToId: walletFromId,
        fromAmount: 10000n,
        toAmount: 10000n,
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
        amount: 10000n,
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

  it('exactly one of two simultaneous 75 USD transfers succeeds', async () => {
    // Two transfers totalling 150 USD against a 100 USD wallet
    const results = await Promise.allSettled([
      service.createTransfer({
        walletFromId,
        walletToId,
        amount: 75,
        fxRate: '1',
      }),
      service.createTransfer({
        walletFromId,
        walletToId,
        amount: 75,
        fxRate: '1',
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      UnprocessableEntityException,
    );
    expect((rejected[0] as PromiseRejectedResult).reason.message).toContain(
      'Insufficient funds',
    );

    // Posted balance is unchanged — the winning transfer's debit is written
    // asynchronously by the outbox consumer, which doesn't run in this test.
    const [credits, debits] = await Promise.all([
      prisma.journalEntry.aggregate({
        where: { walletId: walletFromId, type: JournalEntryType.CREDIT },
        _sum: { amount: true },
      }),
      prisma.journalEntry.aggregate({
        where: { walletId: walletFromId, type: JournalEntryType.DEBIT },
        _sum: { amount: true },
      }),
    ]);

    const postedBalance =
      ((credits._sum.amount as unknown as bigint) ?? 0n) -
      ((debits._sum.amount as unknown as bigint) ?? 0n);

    expect(postedBalance).toBe(10000n); // 100.00 USD — debit not posted yet

    // The winning transfer reserves 75 USD against the wallet until its debit
    // posts (see TransferRepository.computePendingOutgoing), so the wallet's
    // available balance is 25 USD even though the posted balance is still 100.
    const pending = await prisma.transfer.aggregate({
      where: {
        tenantId,
        walletFromId,
        status: { in: [TransferStatus.INITIATED, TransferStatus.PROCESSING] },
      },
      _sum: { fromAmount: true },
    });

    const reserved = (pending._sum.fromAmount as unknown as bigint) ?? 0n;
    expect(reserved).toBe(7500n);
    expect(postedBalance - reserved).toBe(2500n); // 100 - 75 = 25.00 USD available
  });
});
