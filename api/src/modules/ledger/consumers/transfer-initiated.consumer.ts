import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { ClsService } from 'nestjs-cls';
import { Channel, ConsumeMessage } from 'amqplib';
import { TransferStatus, Currency, Prisma } from '@prisma-client';

import { PrismaService } from '@common/database/prisma.service';
import { LedgerService } from '@modules/ledger/ledger.service';
import { TenantStore } from '@common/cls/tenant-store.interface';
import {
  RABBITMQ_CHANNEL,
  TRANSFER_EXCHANGE,
  TRANSFER_QUEUE,
} from '@modules/outbox/rabbitmq.constants';
import {
  DLQ_EXCHANGE,
  DLQ_QUEUE,
  MAX_RETRIES,
  RETRY_DELAY_QUEUES,
  setupDlqTopology,
} from '@modules/outbox/dlq.config';

interface TransferInitiatedPayload {
  transferId: string;
  tenantId: string;
  walletFromId: string;
  walletToId: string;
  fromAmount: string;
  toAmount: string;
  fromCurrency: Currency;
  toCurrency: Currency;
  fxRate: string;
}

@Injectable()
export class TransferInitiatedConsumer
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(TransferInitiatedConsumer.name);
  private consumerTag: string | undefined;

  constructor(
    private readonly ledgerService: LedgerService,
    private readonly prisma: PrismaService,
    private readonly clsService: ClsService<TenantStore>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    @Inject(RABBITMQ_CHANNEL) private readonly channel: Channel,
  ) {}

  async onModuleInit() {
    await setupDlqTopology(this.channel);
    const { consumerTag } = await this.channel.consume(
      TRANSFER_QUEUE,
      (msg) => void this.handleMessage(msg),
    );
    this.consumerTag = consumerTag;
    this.logger.log('TransferInitiatedConsumer ready');
  }

  async onModuleDestroy() {
    if (this.consumerTag) {
      await this.channel.cancel(this.consumerTag);
    }
  }

  private async handleMessage(msg: ConsumeMessage | null) {
    if (!msg) return;

    const headers = (msg.properties.headers ?? {}) as Record<string, unknown>;
    const correlationId = (headers['correlationId'] as string) ?? 'unknown';
    const tenantId = (headers['tenantId'] as string) ?? '';
    const retryCount = Number(headers['x-retry-count'] ?? 0);

    this.logger.log({
      msg: 'transfer.initiated received',
      correlationId,
      tenantId,
      retryCount,
    });

    let payload: TransferInitiatedPayload;
    try {
      payload = JSON.parse(msg.content.toString()) as TransferInitiatedPayload;
    } catch {
      this.logger.error({
        msg: 'malformed message body — routing to DLQ',
        correlationId,
      });
      this.channel.ack(msg);
      this.publishToDlq(msg.content, headers, correlationId);
      return;
    }

        try {
          await this.clsService.runWith(
            { tenantId, correlationId } as TenantStore,
            async () => {
              await this.ledgerService.writeJournalEntries({
                transferId: payload.transferId,
                debitWalletId: payload.walletFromId,
                creditWalletId: payload.walletToId,
                debitAmount: BigInt(payload.fromAmount),
                debitCurrency: payload.fromCurrency,
                creditAmount: BigInt(payload.toAmount),
                creditCurrency: payload.toCurrency,
              });

              await this.prisma.transfer.update({
                where: { id: payload.transferId },
                data: { status: TransferStatus.COMPLETED },
              });
            },
          );

          await Promise.all([
            this.cacheManager.del(
              `wallet:balance:${tenantId}:${payload.walletFromId}`,
            ),
            this.cacheManager.del(
              `wallet:balance:${tenantId}:${payload.walletToId}`,
            ),
          ]);

          this.channel.publish(
            TRANSFER_EXCHANGE,
            'transfer.completed',
            Buffer.from(
              JSON.stringify({ ...payload, status: TransferStatus.COMPLETED }),
            ),
            {
              persistent: true,
              contentType: 'application/json',
              headers: {
                correlationId,
                tenantId,
                eventType: 'TRANSFER_COMPLETED',
              },
            },
          );

          this.channel.ack(msg);

          this.logger.log({
            msg: 'transfer.initiated processed',
            transferId: payload.transferId,
            correlationId,
          });
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            this.logger.warn({
              msg: 'duplicate journal entry detected — skipping (idempotent retry)',
              transferId: payload.transferId,
              correlationId,
            });
            this.channel.ack(msg);
            return;
          }

          this.logger.error({
            msg: 'failed to process transfer.initiated',
            transferId: payload.transferId,
            correlationId,
            retryCount,
            error,
          });

          this.channel.ack(msg);
          await this.scheduleRetryOrDlq(
            msg.content,
            payload,
            headers,
            correlationId,
            retryCount,
          );
        }

  }

  private async scheduleRetryOrDlq(
    content: Buffer,
    payload: TransferInitiatedPayload,
    headers: Record<string, unknown>,
    correlationId: string,
    retryCount: number,
  ) {
    if (retryCount < MAX_RETRIES) {
      const delayQueue = RETRY_DELAY_QUEUES[retryCount];
      this.channel.publish('', delayQueue.name, content, {
        persistent: true,
        contentType: 'application/json',
        headers: { ...headers, correlationId, 'x-retry-count': retryCount + 1 },
      });
      this.logger.warn({
        msg: 'transfer.initiated queued for retry',
        transferId: payload.transferId,
        correlationId,
        nextRetry: retryCount + 1,
        delayMs: delayQueue.ttl,
      });
    } else {
      this.publishToDlq(content, headers, correlationId);
      await this.markTransferFailed(payload, correlationId);
      this.logger.error({
        msg: 'transfer.initiated exhausted retries — sent to DLQ',
        transferId: payload.transferId,
        correlationId,
      });
    }
  }

  // Funds were reserved against walletFromId while this transfer sat at
  // INITIATED (see TransferRepository.computePendingOutgoing). Once retries
  // are exhausted the debit will never post, so the reservation must be
  // released by moving the transfer to a terminal FAILED state, and
  // downstream consumers (webhooks) need to be told the transfer didn't go
  // through.
  private async markTransferFailed(
    payload: TransferInitiatedPayload,
    correlationId: string,
  ): Promise<void> {
    try {
      await this.prisma.transfer.update({
        where: { id: payload.transferId },
        data: { status: TransferStatus.FAILED },
      });

      this.channel.publish(
        TRANSFER_EXCHANGE,
        'transfer.failed',
        Buffer.from(
          JSON.stringify({ ...payload, status: TransferStatus.FAILED }),
        ),
        {
          persistent: true,
          contentType: 'application/json',
          headers: {
            correlationId,
            tenantId: payload.tenantId,
            eventType: 'TRANSFER_FAILED',
          },
        },
      );
    } catch (error) {
      this.logger.error({
        msg: 'failed to mark transfer as FAILED after DLQ routing',
        transferId: payload.transferId,
        correlationId,
        error,
      });
    }
  }

  private publishToDlq(
    content: Buffer,
    headers: Record<string, unknown>,
    correlationId: string,
  ) {
    this.channel.publish(DLQ_EXCHANGE, DLQ_QUEUE, content, {
      persistent: true,
      contentType: 'application/json',
      headers: { ...headers, correlationId },
    });
  }
}
