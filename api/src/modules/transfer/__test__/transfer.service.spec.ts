import {
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Currency, TransferStatus } from '@prisma-client';
import { FxRateService } from '../fx-rate.service';
import { TransferRepository } from '../transfer.repository';
import { TransferService } from '../transfer.service';
import { WalletRepository } from '@modules/wallet/wallet.repository';

const TENANT_A = 'tenant-a';

const mockWalletFrom = {
  id: 'wallet-from',
  tenantId: TENANT_A,
  currency: Currency.USD,
  userId: 'user-1',
  isActive: true,
};

const mockWalletTo = {
  id: 'wallet-to',
  tenantId: TENANT_A,
  currency: Currency.USD,
  userId: 'user-2',
  isActive: true,
};

const mockTransfer = {
  id: 'transfer-1',
  tenantId: TENANT_A,
  walletFromId: mockWalletFrom.id,
  walletToId: mockWalletTo.id,
  fromAmount: 10000n,
  toAmount: 10000n,
  fromCurrency: Currency.USD,
  toCurrency: Currency.USD,
  fxRate: '1',
  status: TransferStatus.INITIATED,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('TransferService', () => {
  let service: TransferService;
  let transferRepository: jest.Mocked<TransferRepository>;
  let walletRepository: jest.Mocked<WalletRepository>;
  let fxRateService: jest.Mocked<FxRateService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransferService,
        {
          provide: TransferRepository,
          useValue: {
            createWithOutbox: jest.fn(),
            findById: jest.fn(),
            updateStatus: jest.fn(),
          },
        },
        {
          provide: WalletRepository,
          useValue: { findById: jest.fn() },
        },
        {
          provide: FxRateService,
          useValue: { getRate: jest.fn().mockReturnValue('1') },
        },
      ],
    }).compile();

    service = module.get(TransferService);
    transferRepository = module.get(TransferRepository);
    walletRepository = module.get(WalletRepository);
    fxRateService = module.get(FxRateService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── createTransfer ────────────────────────────────────────────────────────

  describe('createTransfer', () => {
    const dto = {
      walletFromId: mockWalletFrom.id,
      walletToId: mockWalletTo.id,
      amount: 100,
    };

    it('creates transfer and outbox event atomically on happy path', async () => {
      walletRepository.findById
        .mockResolvedValueOnce(mockWalletFrom as any)
        .mockResolvedValueOnce(mockWalletTo as any);
      transferRepository.createWithOutbox.mockResolvedValue(
        mockTransfer as any,
      );

      const result = await service.createTransfer(dto);

      expect(fxRateService.getRate).toHaveBeenCalledWith(
        Currency.USD,
        Currency.USD,
      );
      expect(transferRepository.createWithOutbox).toHaveBeenCalledWith(
        expect.objectContaining({
          walletFromId: dto.walletFromId,
          walletToId: dto.walletToId,
          fromAmount: 10000n,
          fromCurrency: Currency.USD,
        }),
      );
      expect(result.status).toBe(TransferStatus.INITIATED);
    });

    // ─── amount guards ────────────────────────────────────────────────────────

    it('throws 422 when amount is zero', async () => {
      await expect(
        service.createTransfer({ ...dto, amount: 0 }),
      ).rejects.toThrow(
        new UnprocessableEntityException(
          'Transfer amount must be greater than zero',
        ),
      );
      expect(walletRepository.findById).not.toHaveBeenCalled();
      expect(transferRepository.createWithOutbox).not.toHaveBeenCalled();
    });

    it('throws 422 when amount is negative', async () => {
      await expect(
        service.createTransfer({ ...dto, amount: -50 }),
      ).rejects.toThrow(
        new UnprocessableEntityException(
          'Transfer amount must be greater than zero',
        ),
      );
      expect(walletRepository.findById).not.toHaveBeenCalled();
      expect(transferRepository.createWithOutbox).not.toHaveBeenCalled();
    });

    // ─── wallet resolution guards ─────────────────────────────────────────────

    it('throws 422 when source and destination wallets are the same', async () => {
      walletRepository.findById
        .mockResolvedValueOnce(mockWalletFrom as any)
        .mockResolvedValueOnce(mockWalletFrom as any);

      await expect(
        service.createTransfer({
          walletFromId: mockWalletFrom.id,
          walletToId: mockWalletFrom.id,
          amount: 100,
        }),
      ).rejects.toThrow(
        new UnprocessableEntityException(
          'Source and destination wallets must be different',
        ),
      );
      expect(transferRepository.createWithOutbox).not.toHaveBeenCalled();
    });

    it('throws 422 when walletFrom does not exist in tenant scope', async () => {
      walletRepository.findById.mockResolvedValueOnce(null);

      await expect(service.createTransfer(dto)).rejects.toThrow(
        new UnprocessableEntityException(
          'walletFromId is invalid or does not belong to this tenant',
        ),
      );
      expect(transferRepository.createWithOutbox).not.toHaveBeenCalled();
    });

    it('throws 422 when walletTo does not exist in tenant scope', async () => {
      walletRepository.findById
        .mockResolvedValueOnce(mockWalletFrom as any)
        .mockResolvedValueOnce(null);

      await expect(service.createTransfer(dto)).rejects.toThrow(
        new UnprocessableEntityException(
          'walletToId is invalid or does not belong to this tenant',
        ),
      );
      expect(transferRepository.createWithOutbox).not.toHaveBeenCalled();
    });

    // ─── repository-level guards (bubble up through service) ──────────────────

    it('throws 422 when source wallet has insufficient funds', async () => {
      walletRepository.findById
        .mockResolvedValueOnce(mockWalletFrom as any)
        .mockResolvedValueOnce(mockWalletTo as any);
      // Balance check lives inside TransferRepository.createWithOutbox (SELECT FOR UPDATE + compare).
      // The repository throws UnprocessableEntityException which the service re-throws as-is.
      transferRepository.createWithOutbox.mockRejectedValue(
        new UnprocessableEntityException(
          'Insufficient funds in the source wallet',
        ),
      );

      await expect(service.createTransfer(dto)).rejects.toThrow(
        new UnprocessableEntityException(
          'Insufficient funds in the source wallet',
        ),
      );
      expect(transferRepository.createWithOutbox).toHaveBeenCalledTimes(1);
    });

    it('throws 422 on duplicate idempotency key (P2002 unique constraint)', async () => {
      walletRepository.findById
        .mockResolvedValueOnce(mockWalletFrom as any)
        .mockResolvedValueOnce(mockWalletTo as any);
      transferRepository.createWithOutbox.mockRejectedValue({ code: 'P2002' });

      await expect(
        service.createTransfer({ ...dto, idempotencyKey: 'dup-key' }),
      ).rejects.toThrow(
        new UnprocessableEntityException('Duplicate idempotency key'),
      );
    });

    it('throws 500 on unexpected repository error', async () => {
      walletRepository.findById
        .mockResolvedValueOnce(mockWalletFrom as any)
        .mockResolvedValueOnce(mockWalletTo as any);
      transferRepository.createWithOutbox.mockRejectedValue(
        new Error('connection refused'),
      );

      await expect(service.createTransfer(dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── getTransfer ───────────────────────────────────────────────────────────

  describe('getTransfer', () => {
    it('returns transfer when found', async () => {
      transferRepository.findById.mockResolvedValue(mockTransfer as any);
      const result = await service.getTransfer('transfer-1');
      expect(result.id).toBe('transfer-1');
    });

    it('throws 404 when transfer not found', async () => {
      transferRepository.findById.mockResolvedValue(null);
      await expect(service.getTransfer('missing')).rejects.toThrow(
        new NotFoundException('Transfer not found'),
      );
    });
  });
});
