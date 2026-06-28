import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { TenantStore } from '@common/cls/tenant-store.interface';
import { WalletRepository } from './wallet.repository';
import { CreateWalletDto, ListWalletsQueryDto } from '@modules/wallet/dto';
import { LedgerService } from '@modules/ledger/ledger.service';
import { fromSmallestUnit } from '@common/utils/money.utils';
import {
  generateAccountNumber,
  isUniqueConstraintViolation,
} from '@common/utils/account-number.utils';

const BALANCE_TTL_MS = 60_000; // cache-manager v5+ uses milliseconds

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly walletRepository: WalletRepository,
    private readonly clsService: ClsService<TenantStore>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    @Inject(forwardRef(() => LedgerService))
    private readonly ledgerService: LedgerService,
  ) {}

  async createWallet(dto: CreateWalletDto) {
    const existing = await this.walletRepository.findByUserAndCurrency(
      dto.currency,
    );
    if (existing) {
      throw new ConflictException(
        `User already has an active ${dto.currency} wallet`,
      );
    }

    const tenantId = this.clsService.get('tenantId');
    const MAX_ATTEMPTS = 5;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const accountNumber = generateAccountNumber(tenantId);
      try {
        return await this.walletRepository.create(dto.currency, accountNumber);
      } catch (err) {
        if (isUniqueConstraintViolation(err, 'accountNumber')) {
          this.logger.warn({
            msg: 'account number collision, retrying',
            attempt,
          });
          continue;
        }
        throw new InternalServerErrorException('Failed to create wallet');
      }
    }

    throw new InternalServerErrorException(
      'Failed to generate a unique account number',
    );
  }

  async getWallet(id: string) {
    try {
      const wallet = await this.walletRepository.findByIdForUser(id);
      if (!wallet) throw new NotFoundException('Wallet not found');
      return wallet;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to retrieve wallet');
    }
  }

  async resolveByAccountNumber(accountNumber: string) {
    const wallet =
      await this.walletRepository.findByAccountNumber(accountNumber);
    if (!wallet) throw new NotFoundException('Account number not found');
    return {
      walletId: wallet.id,
      accountNumber: wallet.accountNumber,
      currency: wallet.currency,
    };
  }

  async listWallets(query: ListWalletsQueryDto) {
    try {
      const { currency, isActive, accountNumber, from, to, cursor, limit = 20 } = query;
      return await this.walletRepository.findAllForTenant(
        { currency, isActive, accountNumber, from, to },
        cursor,
        limit,
      );
    } catch {
      throw new InternalServerErrorException('Failed to list wallets');
    }
  }

  async listMyWallets(query: ListWalletsQueryDto) {
    try {
      const { currency, isActive, cursor, limit = 20 } = query;
      return await this.walletRepository.findAllForUser(
        { currency, isActive },
        cursor,
        limit,
      );
    } catch {
      throw new InternalServerErrorException('Failed to list wallets');
    }
  }

  async getBalance(id: string) {
    try {
      const wallet = await this.walletRepository.findByIdForUser(id);
      if (!wallet) throw new NotFoundException('Wallet not found');

      const tenantId = this.clsService.get('tenantId');
      const cacheKey = `wallet:balance:${tenantId}:${id}`;

      const cached = await this.cacheManager.get<number>(cacheKey);
      if (cached !== null && cached !== undefined) {
        this.logger.log({ msg: 'balance cache hit', walletId: id });
        return {
          walletId: id,
          balance: cached,
          currency: wallet.currency,
          cached: true,
        };
      }

      this.logger.log({ msg: 'balance cache miss', walletId: id });
      const rawBalance = await this.ledgerService.computeBalance(id);
      const balance = fromSmallestUnit(rawBalance, wallet.currency);
      await this.cacheManager.set(cacheKey, balance, BALANCE_TTL_MS);

      return {
        walletId: id,
        balance,
        currency: wallet.currency,
        cached: false,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to retrieve balance');
    }
  }
}
