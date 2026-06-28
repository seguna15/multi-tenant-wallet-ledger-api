import { Channel } from 'amqplib';
import { NOTIFICATION_QUEUE } from '@modules/outbox/rabbitmq.constants';

export const NOTIFICATION_DLQ_EXCHANGE = 'notification.events.dlq';
export const NOTIFICATION_DLQ_QUEUE = 'notification.transfer.dlq';
export const NOTIFICATION_MAX_RETRIES = 1;

export const NOTIFICATION_RETRY_DELAY_QUEUES = [
  { name: 'notification.retry.delay.1', ttl: 5_000 },
] as const;

export async function setupNotificationDlqTopology(
  channel: Channel,
): Promise<void> {
  await channel.assertExchange(NOTIFICATION_DLQ_EXCHANGE, 'direct', {
    durable: true,
  });
  await channel.assertQueue(NOTIFICATION_DLQ_QUEUE, { durable: true });
  await channel.bindQueue(
    NOTIFICATION_DLQ_QUEUE,
    NOTIFICATION_DLQ_EXCHANGE,
    NOTIFICATION_DLQ_QUEUE,
  );

  for (const q of NOTIFICATION_RETRY_DELAY_QUEUES) {
    await channel.assertQueue(q.name, {
      durable: true,
      arguments: {
        'x-message-ttl': q.ttl,
        'x-dead-letter-exchange': '', // default exchange
        'x-dead-letter-routing-key': NOTIFICATION_QUEUE, // back to notification.transfer only
      },
    });
  }
}
