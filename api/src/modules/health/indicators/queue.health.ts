// src/modules/health/indicators/queue.health.ts
import { Inject, Injectable } from '@nestjs/common';
import {
  HealthIndicatorService,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { Channel } from 'amqplib';
import {
  RABBITMQ_CHANNEL,
  TRANSFER_QUEUE,
} from '@modules/outbox/rabbitmq.constants';

@Injectable()
export class QueueHealthIndicator {
  constructor(
    @Inject(RABBITMQ_CHANNEL) private readonly channel: Channel,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);

    try {
      const info = await this.channel.checkQueue(TRANSFER_QUEUE);
      return indicator.up({ messageCount: info.messageCount });
    } catch (error) {
      return indicator.down({ error: (error as Error).message });
    }
  }
}
