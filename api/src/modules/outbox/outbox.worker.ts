import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { OutboxEventType } from '@prisma-client';
import { Channel } from 'amqplib';
import { Client } from 'pg';
import { randomUUID } from 'crypto';
import { OutboxRepository } from '@modules/outbox/outbox.repository';
import {
  OUTBOX_CHANNEL,
  PG_NOTIFY_CLIENT,
  RABBITMQ_CHANNEL,
  TRANSFER_EXCHANGE,
} from '@modules/outbox/rabbitmq.constants';

const ROUTING_KEY: Record<OutboxEventType, string> = {
  TRANSFER_INITIATED: 'transfer.initiated',
  TRANSFER_COMPLETED: 'transfer.completed',
  TRANSFER_FAILED: 'transfer.failed',
};

const FALLBACK_INTERVAL_MS = 60_000;

type OutboxRow = Awaited<
  ReturnType<OutboxRepository['findPendingBatch']>
>[number];

@Injectable()
export class OutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxWorker.name);
  private isRunning = false;
  private fallbackTimer: NodeJS.Timeout | undefined;

  constructor(
    private readonly outboxRepository: OutboxRepository,
    @Inject(RABBITMQ_CHANNEL) private readonly channel: Channel,
    @Inject(PG_NOTIFY_CLIENT) private readonly pgClient: Client,
  ) {}

  async onModuleInit() {
    await this.pgClient.query(`LISTEN ${OUTBOX_CHANNEL}`);

    this.pgClient.on('notification', (msg) => {
      this.logger.debug({ msg: 'pg notify received', payload: msg.payload });
      void this.flush();
    });

    // Fallback: drain anything that arrived during a restart window
    this.fallbackTimer = setInterval(
      () => void this.flush(),
      FALLBACK_INTERVAL_MS,
    );

    this.logger.log('OutboxWorker listening on pg channel');
  }

  onModuleDestroy() {
    clearInterval(this.fallbackTimer);
  }

  private async flush() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const events = await this.outboxRepository.findPendingBatch();
      for (const event of events) {
        await this.publish(event);
      }
    } catch (error) {
      this.logger.error({ msg: 'outbox flush failed', error });
    } finally {
      this.isRunning = false;
    }
  }

  private async publish(event: OutboxRow) {
    const payload = event.payload as Record<string, unknown>;
    const correlationId = (payload?.correlationId as string | undefined) ?? randomUUID();
    const routingKey = ROUTING_KEY[event.eventType];

    try {
      this.channel.publish(
        TRANSFER_EXCHANGE,
        routingKey,
        Buffer.from(JSON.stringify(event.payload)),
        {
          persistent: true,
          contentType: 'application/json',
          headers: {
            correlationId,
            tenantId: event.tenantId,
            eventType: event.eventType,
          },
        },
      );

      await this.outboxRepository.markPublished(event.id);

      this.logger.log({
        msg: 'outbox event published',
        eventId: event.id,
        routingKey,
        correlationId,
      });
    } catch (error) {
      this.logger.error({
        msg: 'outbox publish failed',
        eventId: event.id,
        correlationId,
        error,
      });
      await this.outboxRepository.markFailed(event.id);
    }
  }
}
