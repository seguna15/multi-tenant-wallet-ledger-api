import { Test, TestingModule } from '@nestjs/testing';
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Currency, JournalEntryType, Prisma, TransferStatus } from '@prisma-client';
import { LedgerService } from '../ledger.service';
import { LedgerRepository } from '../ledger.repository';
import { WalletService } from '@modules/wallet/wallet.service';

const mockWallet = () => ({
  id: 'wallet-uuid-1',
  currency: Currency.USD,
  tenantId: 'tenant-uuid-1',
});

const mockEntry = (type: JournalEntryType) => ({
  id: `entry-${type.toLowerCase()}-1`,
  walletId: 'wallet-uuid-1',
  transferId: 'transfer-uuid-1',
  tenantId: 'tenant-uuid-1',
  type,
  amount: new Prisma.Decimal(100),
  currency: Currency.USD,
  createdAt: new Date(),
  transfer: {
    id: 'transfer-uuid-1',
    currency: Currency.USD,
    status: TransferStatus.COMPLETED,
  },
});

describe('LedgerService', () => {
  let service: LedgerService;
  let repo: jest.Mocked<LedgerRepository>;
  let walletService: jest.Mocked<Pick<WalletService, 'getWallet'>>;

  beforeEach(async () => {
    repo = {
      writeEntryPair: jest.fn(),
      findByWallet: jest.fn(),
      computeBalance: jest.fn(),
    } as unknown as jest.Mocked<LedgerRepository>;

    walletService = { getWallet: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LedgerService,
        { provide: LedgerRepository, useValue: repo },
        { provide: WalletService, useValue: walletService },
      ],
    }).compile();

    service = module.get(LedgerService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── writeJournalEntries ────────────────────────────────────────────────

  describe('writeJournalEntries', () => {
    const input = {
      transferId: 'transfer-uuid-1',
      debitWalletId: 'wallet-uuid-from',
      creditWalletId: 'wallet-uuid-to',
      amount: 100,
      currency: Currency.USD,
    };

    it('writes a DEBIT and CREDIT entry atomically and returns both', async () => {
      const debit = mockEntry(JournalEntryType.DEBIT);
      const credit = mockEntry(JournalEntryType.CREDIT);
      repo.writeEntryPair.mockResolvedValue([debit, credit]);

      const result = await service.writeJournalEntries(input);

      expect(repo.writeEntryPair).toHaveBeenCalledTimes(1);
      expect(repo.writeEntryPair).toHaveBeenCalledWith(input);
      expect(result.debit.type).toBe(JournalEntryType.DEBIT);
      expect(result.credit.type).toBe(JournalEntryType.CREDIT);
    });

    it('debit and credit carry the same transferId and amount', async () => {
      const debit = mockEntry(JournalEntryType.DEBIT);
      const credit = mockEntry(JournalEntryType.CREDIT);
      repo.writeEntryPair.mockResolvedValue([debit, credit]);

      const result = await service.writeJournalEntries(input);

      expect(result.debit.transferId).toBe(result.credit.transferId);
      expect(result.debit.amount).toBe(result.credit.amount);
    });

    it('throws InternalServerErrorException when repository fails', async () => {
      repo.writeEntryPair.mockRejectedValue(new Error('DB down'));

      await expect(service.writeJournalEntries(input)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── getJournalEntries ──────────────────────────────────────────────────

  describe('getJournalEntries', () => {
    it('returns paginated journal entries for a valid wallet', async () => {
      walletService.getWallet.mockResolvedValue(mockWallet() as any);
      repo.findByWallet.mockResolvedValue({
        items: [mockEntry(JournalEntryType.DEBIT)],
        nextCursor: null,
      });

      const result = await service.getJournalEntries('wallet-uuid-1', {
        limit: 20,
      });

      expect(repo.findByWallet).toHaveBeenCalledWith(
        'wallet-uuid-1',
        undefined,
        undefined,
        20,
      );
      expect(result.items).toHaveLength(1);
      expect(result.nextCursor).toBeNull();
    });

    it('passes type filter and cursor to the repository', async () => {
      walletService.getWallet.mockResolvedValue(mockWallet() as any);
      repo.findByWallet.mockResolvedValue({ items: [], nextCursor: null });

      await service.getJournalEntries('wallet-uuid-1', {
        type: JournalEntryType.CREDIT,
        cursor: 'entry-abc',
        limit: 10,
      });

      expect(repo.findByWallet).toHaveBeenCalledWith(
        'wallet-uuid-1',
        JournalEntryType.CREDIT,
        'entry-abc',
        10,
      );
    });

    it('throws NotFoundException when wallet does not belong to tenant', async () => {
      walletService.getWallet.mockRejectedValue(new NotFoundException('Wallet not found'));

      await expect(
        service.getJournalEntries('wallet-unknown', {}),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getBalance ─────────────────────────────────────────────────────────

  describe('getBalance', () => {
    it('returns SUM(credits) - SUM(debits) derived from journal entries', async () => {
      walletService.getWallet.mockResolvedValue(mockWallet() as any);
      repo.computeBalance.mockResolvedValue(350);

      const result = await service.getBalance('wallet-uuid-1');

      expect(repo.computeBalance).toHaveBeenCalledWith('wallet-uuid-1');
      expect(result).toEqual({
        walletId: 'wallet-uuid-1',
        balance: 350,
        currency: Currency.USD,
      });
    });

    it('returns zero balance when no journal entries exist', async () => {
      walletService.getWallet.mockResolvedValue(mockWallet() as any);
      repo.computeBalance.mockResolvedValue(0);

      const result = await service.getBalance('wallet-uuid-1');

      expect(result.balance).toBe(0);
    });

    it('throws NotFoundException when wallet does not belong to tenant', async () => {
      walletService.getWallet.mockRejectedValue(new NotFoundException('Wallet not found'));

      await expect(service.getBalance('wallet-unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
