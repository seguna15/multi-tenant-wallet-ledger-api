import {
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { LedgerService } from '@modules/ledger/ledger.service';
import { WalletRepository } from '@modules/wallet/wallet.repository';
import { Currency, TransferStatus } from '@prisma-client';
import { TransferRepository } from '../transfer.repository';
import { TransferService } from '../transfer.service';

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
  let ledgerService: jest.Mocked<LedgerService>;

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
          provide: LedgerService,
          useValue: { computeBalance: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(TransferService);
    transferRepository = module.get(TransferRepository);
    walletRepository = module.get(WalletRepository);
    ledgerService = module.get(LedgerService);
  });

  describe('createTransfer', () => {
    const dto = {
      walletFromId: mockWalletFrom.id,
      walletToId: mockWalletTo.id,
      amount: 100,
      fxRate: '1',
    };

    it('creates transfer and outbox event atomically on happy path', async () => {
      walletRepository.findById
        .mockResolvedValueOnce(mockWalletFrom as any)
        .mockResolvedValueOnce(mockWalletTo as any);
      ledgerService.computeBalance.mockResolvedValue(50000n); // 500.00 USD — sufficient
      transferRepository.createWithOutbox.mockResolvedValue(
        mockTransfer as any,
      );

      const result = await service.createTransfer(dto);

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

    it('throws 422 when walletFrom is not resolvable in tenant scope', async () => {
      walletRepository.findById.mockResolvedValueOnce(null);

      await expect(service.createTransfer(dto)).rejects.toThrow(
        new UnprocessableEntityException(
          'walletFromId is invalid or does not belong to this tenant',
        ),
      );
      expect(walletRepository.findById).toHaveBeenCalledTimes(1);
      expect(ledgerService.computeBalance).not.toHaveBeenCalled();
    });

    it('throws 422 when walletTo is not resolvable in tenant scope', async () => {
      walletRepository.findById
        .mockResolvedValueOnce(mockWalletFrom as any)
        .mockResolvedValueOnce(null);

      await expect(service.createTransfer(dto)).rejects.toThrow(
        new UnprocessableEntityException(
          'walletToId is invalid or does not belong to this tenant',
        ),
      );
      expect(ledgerService.computeBalance).not.toHaveBeenCalled();
    });

    it('throws 422 when source wallet has insufficient funds', async () => {
      walletRepository.findById
        .mockResolvedValueOnce(mockWalletFrom as any)
        .mockResolvedValueOnce(mockWalletTo as any);
      ledgerService.computeBalance.mockResolvedValue(500n); // 5.00 USD — not enough for 100.00

      await expect(service.createTransfer(dto)).rejects.toThrow(
        new UnprocessableEntityException('Insufficient funds in source wallet'),
      );
      expect(transferRepository.createWithOutbox).not.toHaveBeenCalled();
    });

    it('throws 422 on duplicate idempotency key (P2002)', async () => {
      walletRepository.findById
        .mockResolvedValueOnce(mockWalletFrom as any)
        .mockResolvedValueOnce(mockWalletTo as any);
      ledgerService.computeBalance.mockResolvedValue(50000n);
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
      ledgerService.computeBalance.mockResolvedValue(50000n);
      transferRepository.createWithOutbox.mockRejectedValue(
        new Error('DB down'),
      );

      await expect(service.createTransfer(dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

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
