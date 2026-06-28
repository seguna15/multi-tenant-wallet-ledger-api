import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Channel, ConsumeMessage } from 'amqplib';
import { TransferStatus, DlqReason, Currency } from '@prisma-client';

import { PrismaService } from '@common/database/prisma.service';
import { DlqPersistService } from '@modules/outbox/dlq-persist.service';
import { TenantStore } from '@common/cls/tenant-store.interface';
import {
  RABBITMQ_CHANNEL,
  TRANSFER_COMPLETED_QUEUE,
  TRANSFER_COMPLETED_DLQ_QUEUE,
  TRANSFER_EXCHANGE,
  
} from '@modules/outbox/rabbitmq.constants';
import {
  DLQ_EXCHANGE,
  MAX_RETRIES,
  RETRY_DELAY_QUEUES,
  setupDlqTopology,
} from '@modules/outbox/dlq.config';
import { NOTIFICATION_DLQ_EXCHANGE, NOTIFICATION_DLQ_QUEUE } from '@modules/outbox/notification.dlq.config';
import { EventEmitter2 } from '@nestjs/event-emitter';



interface TransferCompletedPayload {
  transferId: string;
  tenantId: string;
  walletFromId: string;
  walletToId: string;
  fromAmount: string;
  toAmount: string;
  fromCurrency: Currency;
  toCurrency: Currency;
  fxRate: string;
  status: TransferStatus;
}

@Injectable()
export class TransferCompletedConsumer
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(TransferCompletedConsumer.name);
  private consumerTag: string | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly clsService: ClsService<TenantStore>,
    @Inject(RABBITMQ_CHANNEL) private readonly channel: Channel,
    private readonly dlqPersist: DlqPersistService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async onModuleInit() {
    await this.assertDlqQueue();
    const { consumerTag } = await this.channel.consume(
      TRANSFER_COMPLETED_QUEUE,
      (msg) => void this.handleMessage(msg),
    );
    this.consumerTag = consumerTag;
    this.logger.log('TransferCompletedConsumer ready');
  }

  async onModuleDestroy() {
    if (this.consumerTag) await this.channel.cancel(this.consumerTag);
  }

  private async handleMessage(msg: ConsumeMessage | null) {
    if (!msg) return;

    const headers = (msg.properties.headers ?? {}) as Record<string, unknown>;
    const correlationId = (headers['correlationId'] as string) ?? 'unknown';
    const tenantId = (headers['tenantId'] as string) ?? '';
    const retryCount = Number(headers['x-retry-count'] ?? 0);

    this.logger.log({
      msg: 'transfer.completed received',
      correlationId,
      tenantId,
      retryCount,
    });

    let payload: TransferCompletedPayload;
    try {
      payload = JSON.parse(msg.content.toString()) as TransferCompletedPayload;
    } catch {
      this.logger.error({
        msg: 'malformed message — routing to DLQ',
        correlationId,
      });
      this.channel.ack(msg);
      this.publishToDlq(msg.content, headers, correlationId, tenantId, DlqReason.MALFORMED_MESSAGE);
      return;
    }

    try {
      await this.clsService.runWith(
        { tenantId, correlationId } as TenantStore,
        async () => {
          // Guard: only advance from INITIATED → COMPLETED; idempotent if already COMPLETED
          await this.prisma.transfer.updateMany({
            where: {
              id: payload.transferId,
              tenantId,
              status: TransferStatus.INITIATED,
            },
            data: { status: TransferStatus.COMPLETED },
          });

           this.eventEmitter.emit('transfer.status', {
             transferId: payload.transferId,
             tenantId,
             status: TransferStatus.COMPLETED,
           });
        },
      );

     

      this.channel.ack(msg);
      this.logger.log({
        msg: 'transfer.completed processed',
        transferId: payload.transferId,
        correlationId,
      });
    } catch (error) {
      this.logger.error({
        msg: 'failed to process transfer.completed',
        transferId: payload.transferId,
        correlationId,
        retryCount,
        error,
      });
      this.channel.ack(msg);
      this.scheduleRetryOrDlq(
        msg.content,
        payload.transferId,
        headers,
        correlationId,
        retryCount,
        tenantId,
      );
    }
  }

  private scheduleRetryOrDlq(
    content: Buffer,
    transferId: string,
    headers: Record<string, unknown>,
    correlationId: string,
    retryCount: number,
    tenantId: string,
  ) {
    if (retryCount < MAX_RETRIES) {
      const delayQueue = RETRY_DELAY_QUEUES[retryCount];
      this.channel.publish('', delayQueue.name, content, {
        persistent: true,
        contentType: 'application/json',
        headers: { ...headers, correlationId, 'x-retry-count': retryCount + 1 },
      });
      this.logger.warn({
        msg: 'transfer.completed queued for retry',
        transferId,
        correlationId,
        nextRetry: retryCount + 1,
        delayMs: delayQueue.ttl,
      });
    } else {
      this.publishToDlq(content, headers, correlationId,tenantId, DlqReason.MAX_RETRIES_EXHAUSTED);
      this.logger.error({
        msg: 'transfer.completed exhausted retries — sent to DLQ',
        transferId,
        correlationId,
      });
    }
  }

  // Replace the existing publishToDlq signature:
  private publishToDlq(
    content: Buffer,
    headers: Record<string, unknown>,
    correlationId: string,
    tenantId: string,
    reason: DlqReason,
  ) {
    this.channel.publish(
      NOTIFICATION_DLQ_EXCHANGE,
      NOTIFICATION_DLQ_QUEUE,
      content,
      {
        persistent: true,
        contentType: 'application/json',
        headers: { ...headers, correlationId },
      },
    );

    void this.dlqPersist.persist({
      queue: NOTIFICATION_DLQ_QUEUE,
      exchange: NOTIFICATION_DLQ_EXCHANGE,
      routingKey: NOTIFICATION_DLQ_QUEUE,
      payload: content,
      headers,
      correlationId,
      tenantId,
      reason,
    });
  }

  // Reuses the DLQ exchange from dlq.config but with its own queue name
  private async assertDlqQueue() {
    await setupDlqTopology(this.channel); // idempotent — asserts exchange + retry delay queues
    await this.channel.assertQueue(TRANSFER_COMPLETED_DLQ_QUEUE, {
      durable: true,
    });
    await this.channel.bindQueue(
      TRANSFER_COMPLETED_DLQ_QUEUE,
      DLQ_EXCHANGE,
      TRANSFER_COMPLETED_DLQ_QUEUE,
    );
  }
}
