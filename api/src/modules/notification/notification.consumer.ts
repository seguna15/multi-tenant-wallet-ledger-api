import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Channel, ConsumeMessage } from 'amqplib';
import { Currency,DlqReason, TransferStatus } from '@prisma-client';
import { DlqPersistService } from '@modules/outbox/dlq-persist.service';
import {
  RABBITMQ_CHANNEL,
  NOTIFICATION_QUEUE,
} from '@modules/outbox/rabbitmq.constants';
import {
  NOTIFICATION_DLQ_EXCHANGE,
  NOTIFICATION_DLQ_QUEUE,
  NOTIFICATION_MAX_RETRIES,
  NOTIFICATION_RETRY_DELAY_QUEUES,
  setupNotificationDlqTopology,
} from '@modules/outbox/notification.dlq.config';
import { WebhookService, WebhookPayload } from './webhook.service';

const PROCESSABLE_EVENTS = new Set(['TRANSFER_COMPLETED', 'TRANSFER_FAILED']);

interface TransferEventPayload {
  transferId: string;
  tenantId: string;
  toAmount: string;
  toCurrency: Currency;
  status: TransferStatus;
}

@Injectable()
export class NotificationConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationConsumer.name);
  private consumerTag: string | undefined;

  constructor(
    private readonly webhookService: WebhookService,
    private readonly dlqPersist: DlqPersistService,
    @Inject(RABBITMQ_CHANNEL) private readonly channel: Channel,
  ) {}

  async onModuleInit() {
    await setupNotificationDlqTopology(this.channel);
    const { consumerTag } = await this.channel.consume(
      NOTIFICATION_QUEUE,
      (msg) => void this.handleMessage(msg),
    );
    this.consumerTag = consumerTag;
    this.logger.log('NotificationConsumer ready');
  }

  async onModuleDestroy() {
    if (this.consumerTag) await this.channel.cancel(this.consumerTag);
  }

  private async handleMessage(msg: ConsumeMessage | null) {
    if (!msg) return;

    const headers = (msg.properties.headers ?? {}) as Record<string, unknown>;
    const correlationId = (headers['correlationId'] as string) ?? 'unknown';
    const tenantId = (headers['tenantId'] as string) ?? '';
    const eventType = (headers['eventType'] as string) ?? '';
    const retryCount = Number(headers['x-retry-count'] ?? 0);

    // notification.transfer queue is bound to transfer.* — skip non-webhook events silently
    if (!PROCESSABLE_EVENTS.has(eventType)) {
      this.channel.ack(msg);
      return;
    }

    let payload: TransferEventPayload;
    try {
      payload = JSON.parse(msg.content.toString()) as TransferEventPayload;
    } catch {
      this.logger.error({
        msg: 'malformed notification message — routing to DLQ',
        correlationId,
      });
      this.channel.ack(msg);
      this.publishToDlq(msg.content, headers, correlationId, tenantId, DlqReason.MALFORMED_MESSAGE);
      return;
    }

    this.logger.log({
      msg: 'notification event received',
      eventType,
      transferId: payload.transferId,
      correlationId,
      retryCount,
    });

    const webhookPayload: WebhookPayload = {
      transferId: payload.transferId,
      status: payload.status,
      amount: payload.toAmount,
      currency: payload.toCurrency,
      timestamp: new Date().toISOString(),
    };

    try {
      await this.webhookService.deliver(
        tenantId,
        webhookPayload,
        correlationId,
      );
      this.channel.ack(msg);
      this.logger.log({
        msg: 'notification processed',
        transferId: payload.transferId,
        correlationId,
      });
    } catch (error) {
      this.logger.error({
        msg: 'notification delivery failed',
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
    if (retryCount < NOTIFICATION_MAX_RETRIES) {
      const delayQueue = NOTIFICATION_RETRY_DELAY_QUEUES[retryCount];
      this.channel.publish('', delayQueue.name, content, {
        persistent: true,
        contentType: 'application/json',
        headers: { ...headers, correlationId, 'x-retry-count': retryCount + 1 },
      });
      this.logger.warn({
        msg: 'notification queued for retry',
        transferId,
        correlationId,
        nextRetry: retryCount + 1,
        delayMs: delayQueue.ttl,
      });
    } else {
      this.publishToDlq(
        content,
        headers,
        correlationId,
        tenantId,
        DlqReason.MAX_RETRIES_EXHAUSTED,
      );
      this.logger.error({
        msg: 'notification exhausted retries — sent to DLQ',
        transferId,
        correlationId,
      });
    }
  }

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
}
