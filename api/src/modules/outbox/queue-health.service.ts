import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Channel } from 'amqplib';
import {
  RABBITMQ_CHANNEL,
  TRANSFER_QUEUE,
  TRANSFER_COMPLETED_DLQ_QUEUE,
} from '@modules/outbox/rabbitmq.constants';
import { DLQ_QUEUE } from '@modules/outbox/dlq.config';
import { NOTIFICATION_DLQ_QUEUE } from '@modules/outbox/notification.dlq.config';

interface QueueDepth {
  queue: string;
  messageCount: number;
}

const ALERT_THRESHOLD = 0; // alert the moment anything lands in a DLQ
const CHECK_INTERVAL_MS = 30_000;

const WATCHED_DLQ_QUEUES = [
  DLQ_QUEUE,
  TRANSFER_COMPLETED_DLQ_QUEUE,
  NOTIFICATION_DLQ_QUEUE,
] as const;

@Injectable()
export class QueueHealthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueHealthService.name);
  private intervalHandle: NodeJS.Timeout | undefined;

  constructor(@Inject(RABBITMQ_CHANNEL) private readonly channel: Channel) {}

  onModuleInit(): void {
    this.intervalHandle = setInterval(
      () => void this.checkQueues(),
      CHECK_INTERVAL_MS,
    );
    this.logger.log('QueueHealthService started — polling every 30s');
  }

  onModuleDestroy(): void {
    if (this.intervalHandle) clearInterval(this.intervalHandle);
  }

  private async checkQueues(): Promise<void> {
    const results: QueueDepth[] = [];

    for (const queue of WATCHED_DLQ_QUEUES) {
      try {
        const { messageCount } = await this.channel.checkQueue(queue);
        results.push({ queue, messageCount });
      } catch (err) {
        this.logger.warn({ msg: 'queue health check failed', queue, err });
      }
    }

    const alertQueues = results.filter((r) => r.messageCount > ALERT_THRESHOLD);

    if (alertQueues.length > 0) {
      // Log at ERROR so this surfaces in any error-level alert sink (Datadog, CloudWatch, etc.)
      this.logger.error({
        msg: 'DLQ depth alert — messages require attention',
        queues: alertQueues,
        checkedAt: new Date().toISOString(),
      });
    } else {
      this.logger.debug({ msg: 'DLQ depth check passed', results });
    }
  }
}
