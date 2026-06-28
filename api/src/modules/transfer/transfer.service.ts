import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { WalletRepository } from '@modules/wallet/wallet.repository';
import { toCsv } from '@common/utils/csv.utils';
import { convertWithFxRate, toSmallestUnit } from '@common/utils/money.utils';
import {  TransferRepository } from '@modules/transfer/transfer.repository';
import { FxRateService } from '@modules/transfer/fx-rate.service';
 import {
   CreateTransferDto,
   ExportTenantTransfersQueryDto,
   ExportTransfersQueryDto,
   ListTransfersQueryDto,
 } from '@modules/transfer/dto';
import { PassThrough } from 'node:stream';
import { EXPORT_COLUMNS, EXPORT_PAGE_SIZE, TENANT_EXPORT_COLUMNS } from '@modules/transfer/constants';


@Injectable()
export class TransferService {
  private readonly logger = new Logger(TransferService.name);

  constructor(
    private readonly transferRepository: TransferRepository,
    private readonly walletRepository: WalletRepository,
    private readonly fxRateService: FxRateService,
  ) {}

  async createTransfer(dto: CreateTransferDto) {
    const { walletFromId, walletToId, amount, idempotencyKey } = dto;

    if (amount <= 0) {
      throw new UnprocessableEntityException(
        'Transfer amount must be greater than zero',
      );
    }

    if (walletFromId === walletToId) {
      throw new UnprocessableEntityException(
        'Source and destination wallets must be different',
      );
    }

    const [walletFrom, walletTo] = await Promise.all([
      this.walletRepository.findById(walletFromId),
      this.walletRepository.findById(walletToId),
    ]);

    if (!walletFrom) {
      throw new UnprocessableEntityException(
        'walletFromId is invalid or does not belong to this tenant',
      );
    }
    if (!walletTo) {
      throw new UnprocessableEntityException(
        'walletToId is invalid or does not belong to this tenant',
      );
    }

    const fxRate = this.fxRateService.getRate(
      walletFrom.currency,
      walletTo.currency,
    );
    const fromAmount = toSmallestUnit(amount, walletFrom.currency);
    const toAmount = convertWithFxRate(
      fromAmount,
      fxRate,
      walletFrom.currency,
      walletTo.currency,
    );

    try {
      const transfer = await this.transferRepository.createWithOutbox({
        walletFromId,
        walletToId,
        fromAmount,
        toAmount,
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
      if (error instanceof UnprocessableEntityException) throw error;
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

  async isTransferVisibleToUser(
    transferId: string,
    tenantId: string,
    userId: string,
  ): Promise<boolean> {
    return this.transferRepository.existsForUser(transferId, tenantId, userId);
  }

  async listTransfersForTenant(query: ListTransfersQueryDto) {
    try {
      const { status, from, to, accountNumber, cursor, limit = 20 } = query;
      return await this.transferRepository.findAllForTenant(
        { status, from, to, accountNumber },
        cursor,
        limit,
      );
    } catch (error) {
      this.logger.error({ msg: 'failed to list transfers for tenant', error });
      throw new InternalServerErrorException('Failed to retrieve transfers');
    }
  }

  async listMyTransfers(query: ListTransfersQueryDto) {
    try {
      const { status, from, to, cursor, limit = 20 } = query;
      return await this.transferRepository.findAllForUser(
        { status, from, to },
        cursor,
        limit,
      );
    } catch (error) {
      this.logger.error({ msg: 'failed to list my transfers', error });
      throw new InternalServerErrorException('Failed to retrieve transfers');
    }
  }

  // Streams a CSV of the authenticated user's transfers without ever
  // materialising the full result set in memory.
  streamMyTransfersExport(
    query: ExportTransfersQueryDto,
    signal: AbortSignal,
  ): PassThrough {
    const { status, from, to } = query;
    const output = new PassThrough();

    void (async () => {
      try {
        output.write(`${toCsv([], EXPORT_COLUMNS)}\n`);

        let cursor: string | undefined;
        do {
          if (signal.aborted || output.destroyed) return;

          const { items, nextCursor } =
            await this.transferRepository.findPageForExport(
              { status, from, to },
              cursor,
              EXPORT_PAGE_SIZE,
            );

          if (items.length > 0) {
            const chunk = `${toCsv(items, EXPORT_COLUMNS, { includeHeader: false })}\n`;
            if (!output.write(chunk)) {
              await new Promise<void>((resolve) =>
                output.once('drain', resolve),
              );
            }
          }

          cursor = nextCursor ?? undefined;
        } while (cursor);

        output.end();
      } catch (error) {
        this.logger.error({ msg: 'failed to stream transfer export', error });
        output.destroy(error as Error);
      }
    })();

    return output;
  }

  // Streams a CSV of every transfer in the tenant without ever
  // materialising the full result set in memory.
  streamTenantTransfersExport(
    query: ExportTenantTransfersQueryDto,
    signal: AbortSignal,
  ): PassThrough {
    const { status, from, to, accountNumber } = query;
    const output = new PassThrough();

    void (async () => {
      try {
        output.write(`${toCsv([], TENANT_EXPORT_COLUMNS)}\n`);

        let cursor: string | undefined;
        do {
          if (signal.aborted || output.destroyed) return;

          const { items, nextCursor } =
            await this.transferRepository.findPageForTenantExport(
              { status, from, to, accountNumber },
              cursor,
              EXPORT_PAGE_SIZE,
            );

          if (items.length > 0) {
            const chunk = `${toCsv(items, TENANT_EXPORT_COLUMNS, { includeHeader: false })}\n`;
            if (!output.write(chunk)) {
              await new Promise<void>((resolve) =>
                output.once('drain', resolve),
              );
            }
          }

          cursor = nextCursor ?? undefined;
        } while (cursor);

        output.end();
      } catch (error) {
        this.logger.error({
          msg: 'failed to stream tenant transfer export',
          error,
        });
        output.destroy(error as Error);
      }
    })();

    return output;
  }
}
