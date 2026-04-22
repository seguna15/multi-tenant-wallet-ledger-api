import {
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import { Currency, Wallet } from '@prisma-client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { WalletRepository } from '../wallet.repository';
import { WalletService } from '../wallet.service';

const mockWallet = (overrides: Partial<Wallet> = {}): Wallet => ({
  id: 'wallet-uuid-1',
  tenantId: 'tenant-uuid-1',
  userId: 'user-uuid-1',
  currency: Currency.USD,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const mockPage = <T>(items: T[], nextCursor: string | null = null) => ({
  items,
  nextCursor,
});

const mockAdminWallet = (overrides: Partial<Wallet> = {}) => ({
  ...mockWallet(overrides),
  tenant: { id: 'tenant-uuid-1', name: 'Test Tenant' },
});

describe('WalletService', () => {
  let service: WalletService;
  let repo: jest.Mocked<WalletRepository>;
  let cacheManager: { get: jest.Mock; set: jest.Mock };
  let cls: jest.Mocked<Pick<ClsService, 'get'>>;

  beforeEach(async () => {
    repo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByUserAndCurrency: jest.fn(),
      findAllForTenant: jest.fn(),
      findAllForUser: jest.fn(),
      findAll: jest.fn(),
      computeBalance: jest.fn(),
    } as unknown as jest.Mocked<WalletRepository>;

    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
    };

    cls = { get: jest.fn().mockReturnValue('tenant-uuid-1') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: WalletRepository, useValue: repo },
        { provide: CACHE_MANAGER, useValue: cacheManager },
        { provide: ClsService, useValue: cls },
      ],
    }).compile();

    service = module.get(WalletService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── createWallet ────────────────────────────────────────────────────────────

  describe('createWallet', () => {
    it('creates and returns a new wallet', async () => {
      repo.findByUserAndCurrency.mockResolvedValue(null);
      repo.create.mockResolvedValue(mockWallet());

      const result = await service.createWallet({ currency: Currency.USD });

      expect(result).toEqual(mockWallet());
      expect(repo.findByUserAndCurrency).toHaveBeenCalledWith(Currency.USD);
      expect(repo.create).toHaveBeenCalledWith(Currency.USD);
    });

    it('throws ConflictException when wallet already exists for user+currency', async () => {
      repo.findByUserAndCurrency.mockResolvedValue(mockWallet());

      await expect(
        service.createWallet({ currency: Currency.USD }),
      ).rejects.toThrow(ConflictException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('throws InternalServerErrorException on unexpected repository error', async () => {
      repo.findByUserAndCurrency.mockRejectedValue(new Error('DB timeout'));

      await expect(
        service.createWallet({ currency: Currency.USD }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ── getWallet ───────────────────────────────────────────────────────────────

  describe('getWallet', () => {
    it('returns the wallet when found', async () => {
      repo.findById.mockResolvedValue(mockWallet());

      const result = await service.getWallet('wallet-uuid-1');

      expect(result).toEqual(mockWallet());
    });

    it('throws NotFoundException when wallet does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.getWallet('bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws InternalServerErrorException on unexpected error', async () => {
      repo.findById.mockRejectedValue(new Error('DB down'));

      await expect(service.getWallet('wallet-uuid-1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ── listWallets ─────────────────────────────────────────────────────────────

  describe('listWallets', () => {
    it('returns the first page with no filters', async () => {
      const wallet = mockWallet();
      repo.findAllForTenant.mockResolvedValue(mockPage([wallet]));

      const result = await service.listWallets({});

      expect(result).toEqual(mockPage([wallet]));
      expect(repo.findAllForTenant).toHaveBeenCalledWith(
        { currency: undefined, isActive: undefined },
        undefined,
        20,
      );
    });

    it('passes currency and isActive filters to the repository', async () => {
      repo.findAllForTenant.mockResolvedValue(mockPage([]));

      await service.listWallets({ currency: Currency.USD, isActive: true, limit: 10 });

      expect(repo.findAllForTenant).toHaveBeenCalledWith(
        { currency: Currency.USD, isActive: true },
        undefined,
        10,
      );
    });

    it('passes cursor for subsequent pages', async () => {
      repo.findAllForTenant.mockResolvedValue(mockPage([]));

      await service.listWallets({ cursor: 'wallet-uuid-1', limit: 5 });

      expect(repo.findAllForTenant).toHaveBeenCalledWith(
        { currency: undefined, isActive: undefined },
        'wallet-uuid-1',
        5,
      );
    });

    it('returns nextCursor when more pages exist', async () => {
      const w1 = mockWallet({ id: 'wallet-uuid-1' });
      const w2 = mockWallet({ id: 'wallet-uuid-2' });
      repo.findAllForTenant.mockResolvedValue(mockPage([w1, w2], 'wallet-uuid-2'));

      const result = await service.listWallets({ limit: 2 });

      expect(result.nextCursor).toBe('wallet-uuid-2');
    });

    it('throws InternalServerErrorException on repository error', async () => {
      repo.findAllForTenant.mockRejectedValue(new Error('DB down'));

      await expect(service.listWallets({})).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ── listMyWallets ───────────────────────────────────────────────────────────

  describe('listMyWallets', () => {
    it("returns the current user's wallets with no filters", async () => {
      const wallet = mockWallet();
      repo.findAllForUser.mockResolvedValue(mockPage([wallet]));

      const result = await service.listMyWallets({});

      expect(result).toEqual(mockPage([wallet]));
      expect(repo.findAllForUser).toHaveBeenCalledWith(
        { currency: undefined, isActive: undefined },
        undefined,
        20,
      );
    });

    it('passes filters and cursor to the repository', async () => {
      repo.findAllForUser.mockResolvedValue(mockPage([]));

      await service.listMyWallets({
        currency: Currency.USD,
        isActive: false,
        cursor: 'wallet-uuid-1',
        limit: 5,
      });

      expect(repo.findAllForUser).toHaveBeenCalledWith(
        { currency: Currency.USD, isActive: false },
        'wallet-uuid-1',
        5,
      );
    });

    it('throws InternalServerErrorException on repository error', async () => {
      repo.findAllForUser.mockRejectedValue(new Error('DB down'));

      await expect(service.listMyWallets({})).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ── listAllWallets ──────────────────────────────────────────────────────────

  describe('listAllWallets', () => {
    it('returns wallets across all tenants with no filters', async () => {
      const wallet = mockAdminWallet();
      repo.findAll.mockResolvedValue(mockPage([wallet]));

      const result = await service.listAllWallets({});

      expect(result).toEqual(mockPage([wallet]));
      expect(repo.findAll).toHaveBeenCalledWith(
        { currency: undefined, isActive: undefined },
        undefined,
        20,
      );
    });

    it('passes filters and cursor to the repository', async () => {
      repo.findAll.mockResolvedValue(mockPage([]));

      await service.listAllWallets({ currency: Currency.USD, cursor: 'wallet-uuid-1', limit: 50 });

      expect(repo.findAll).toHaveBeenCalledWith(
        { currency: Currency.USD, isActive: undefined },
        'wallet-uuid-1',
        50,
      );
    });

    it('throws InternalServerErrorException on repository error', async () => {
      repo.findAll.mockRejectedValue(new Error('DB down'));

      await expect(service.listAllWallets({})).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ── getBalance ──────────────────────────────────────────────────────────────

  describe('getBalance', () => {
    it('returns cached balance without hitting the DB', async () => {
      repo.findById.mockResolvedValue(mockWallet());
      cacheManager.get.mockResolvedValue(500);

      const result = await service.getBalance('wallet-uuid-1');

      expect(result).toEqual({
        walletId: 'wallet-uuid-1',
        balance: 500,
        currency: Currency.USD,
        cached: true,
      });
      expect(repo.computeBalance).not.toHaveBeenCalled();
      expect(cacheManager.set).not.toHaveBeenCalled();
    });

    it('computes balance from DB on cache miss and caches the result', async () => {
      repo.findById.mockResolvedValue(mockWallet());
      cacheManager.get.mockResolvedValue(null);
      repo.computeBalance.mockResolvedValue(1200);

      const result = await service.getBalance('wallet-uuid-1');

      expect(result).toEqual({
        walletId: 'wallet-uuid-1',
        balance: 1200,
        currency: Currency.USD,
        cached: false,
      });
      expect(repo.computeBalance).toHaveBeenCalledWith('wallet-uuid-1');
      expect(cacheManager.set).toHaveBeenCalledWith(
        'wallet:balance:tenant-uuid-1:wallet-uuid-1',
        1200,
        60_000,
      );
    });

    it('throws NotFoundException when wallet does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.getBalance('bad-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(cacheManager.get).not.toHaveBeenCalled();
    });

    it('throws InternalServerErrorException on unexpected error', async () => {
      repo.findById.mockResolvedValue(mockWallet());
      cacheManager.get.mockRejectedValue(new Error('Redis unreachable'));

      await expect(service.getBalance('wallet-uuid-1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});