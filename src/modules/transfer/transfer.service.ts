import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { WalletRepository } from '@modules/wallet/wallet.repository';
import { LedgerService } from '@modules/ledger/ledger.service';
import { convertWithFxRate, toSmallestUnit } from '@common/utils/money.utils';
import { CreateTransferDto } from '@modules/transfer/dto';
import { TransferRepository } from '@modules/transfer/transfer.repository';

@Injectable()
export class TransferService {
  private readonly logger = new Logger(TransferService.name);

  constructor(
    private readonly transferRepository: TransferRepository,
    private readonly walletRepository: WalletRepository,
    private readonly ledgerService: LedgerService,
  ) {}

  async createTransfer(dto: CreateTransferDto) {
    const {
      walletFromId,
      walletToId,
      amount,
      fxRate = '1',
      idempotencyKey,
    } = dto;

    const walletFrom = await this.walletRepository.findById(walletFromId);
    if (!walletFrom) {
      throw new UnprocessableEntityException(
        'walletFromId is invalid or does not belong to this tenant',
      );
    }

    const walletTo = await this.walletRepository.findById(walletToId);
    if (!walletTo) {
      throw new UnprocessableEntityException(
        'walletToId is invalid or does not belong to this tenant',
      );
    }

    const fromAmountSmallest = toSmallestUnit(amount, walletFrom.currency);
    const currentBalance =
      await this.ledgerService.computeBalance(walletFromId);
    if (currentBalance < fromAmountSmallest) {
      throw new UnprocessableEntityException(
        'Insufficient funds in source wallet',
      );
    }

    const toAmountSmallest = convertWithFxRate(
      fromAmountSmallest,
      fxRate,
      walletFrom.currency,
      walletTo.currency,
    );

    try {
      const transfer = await this.transferRepository.createWithOutbox({
        walletFromId,
        walletToId,
        fromAmount: fromAmountSmallest,
        toAmount: toAmountSmallest,
        fromCurrency: walletFrom.currency,
        toCurrency: walletTo.currency,
        fxRate,
        idempotencyKey,
      });

      this.logger.log({
        msg: 'transfer initiated',
        transferId: transfer.id,
        walletFromId,
        walletToId,
      });
      return transfer;
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new UnprocessableEntityException('Duplicate idempotency key');
      }
      this.logger.error({ msg: 'failed to create transfer', error });
      throw new InternalServerErrorException('Failed to create transfer');
    }
  }

  async getTransfer(id: string) {
    try {
      const transfer = await this.transferRepository.findById(id);
      if (!transfer) throw new NotFoundException('Transfer not found');
      return transfer;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to retrieve transfer');
    }
  }
}
