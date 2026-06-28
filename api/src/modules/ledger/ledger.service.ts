import {
    forwardRef,
    Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  LedgerRepository,
} from '@modules/ledger/ledger.repository';
import { ListJournalEntriesQueryDto } from '@modules/ledger/dto';
import { WriteJournalEntriesInput } from '@modules/ledger/types';
import { WalletService } from '@modules/wallet/wallet.service';
import { fromSmallestUnit } from '@common/utils/money.utils';

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(
    private readonly ledgerRepository: LedgerRepository,
    @Inject(forwardRef(() => WalletService))
    private readonly walletService: WalletService,
  ) {}

  async writeJournalEntries(input: WriteJournalEntriesInput) {
    try {
      const [debit, credit] = await this.ledgerRepository.writeEntryPair(input);
      this.logger.log({
        msg: 'journal entry pair written',
        transferId: input.transferId,
        debitWalletId: input.debitWalletId,
        creditWalletId: input.creditWalletId,
      });
      return { debit, credit };
    } catch (error) {
      this.logger.error({
        msg: 'failed to write journal entries',
        error,
        transferId: input.transferId,
      });
      throw new InternalServerErrorException('Failed to write journal entries');
    }
  }

  async getJournalEntries(walletId: string, query: ListJournalEntriesQueryDto) {
    try {
      const wallet =
        await this.walletService.getWallet(walletId);
      if (!wallet) throw new NotFoundException('Wallet not found');

      const { type, cursor, limit = 20 } = query;
      return await this.ledgerRepository.findByWallet(
        walletId,
        type,
        cursor,
        limit,
      );
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'Failed to retrieve journal entries',
      );
    }
  }

  async getBalance(walletId: string) {
    try {
      const wallet =
        await this.walletService.getWallet(walletId);
      if (!wallet) throw new NotFoundException('Wallet not found');

      const rawBalance = await this.ledgerRepository.computeBalance(walletId);
      const balance = fromSmallestUnit(rawBalance, wallet.currency);
      return { walletId, balance, currency: wallet.currency };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to compute balance');
    }
  }

  // ledger.service.ts
  async computeBalance(walletId: string): Promise<bigint> {
    return this.ledgerRepository.computeBalance(walletId);
  }
}
