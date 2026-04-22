import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  ConflictException,
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

const BALANCE_TTL_MS = 60_000; // cache-manager v5+ uses milliseconds

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly walletRepository: WalletRepository,
    private readonly clsService: ClsService<TenantStore>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async createWallet(dto: CreateWalletDto) {
    try {
      const existing = await this.walletRepository.findByUserAndCurrency(
        dto.currency,
      );
      if (existing) {
        throw new ConflictException(
          `User already has an active ${dto.currency} wallet`,
        );
      }
      return await this.walletRepository.create(dto.currency);
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw new InternalServerErrorException('Failed to create wallet');
    }
  }

  async getWallet(id: string) {
    try {
      const wallet = await this.walletRepository.findById(id);
      if (!wallet) throw new NotFoundException('Wallet not found');
      return wallet;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to retrieve wallet');
    }
  }

  async listWallets(query: ListWalletsQueryDto) {
    try {
      const { currency, isActive, cursor, limit = 20 } = query;
      return await this.walletRepository.findAllForTenant({ currency, isActive }, cursor, limit);
    } catch {
      throw new InternalServerErrorException('Failed to list wallets');
    }
  }

  async listMyWallets(query: ListWalletsQueryDto) {
    try {
      const { currency, isActive, cursor, limit = 20 } = query;
      return await this.walletRepository.findAllForUser({ currency, isActive }, cursor, limit);
    } catch {
      throw new InternalServerErrorException('Failed to list wallets');
    }
  }

  async listAllWallets(query: ListWalletsQueryDto) {
    try {
      const { currency, isActive, cursor, limit = 20 } = query;
      return await this.walletRepository.findAll({ currency, isActive }, cursor, limit);
    } catch {
      throw new InternalServerErrorException('Failed to list wallets');
    }
  }

  async getBalance(id: string) {
    try {
      const wallet = await this.walletRepository.findById(id);
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
      const balance = await this.walletRepository.computeBalance(id);
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
