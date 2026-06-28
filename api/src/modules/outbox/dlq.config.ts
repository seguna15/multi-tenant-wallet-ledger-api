import { Channel } from 'amqplib';
import { TRANSFER_EXCHANGE } from '@modules/outbox/rabbitmq.constants';

export const DLQ_EXCHANGE = 'transfer.events.dlq';
export const DLQ_QUEUE = 'transfer.initiated.dlq';
export const MAX_RETRIES = 3;

export const RETRY_DELAY_QUEUES = [
  { name: 'transfer.retry.delay.1', ttl: 1_000 },
  { name: 'transfer.retry.delay.2', ttl: 2_000 },
  { name: 'transfer.retry.delay.3', ttl: 4_000 },
] as const;

/**
 * Declares the DLQ exchange/queue and the three TTL-based retry-delay queues.
 * Each delay queue dead-letters back to the main transfer exchange so the
 * message re-enters `transfer.initiated` after the TTL elapses.
 * Safe to call on every startup — assertExchange/assertQueue are idempotent.
 */
export async function setupDlqTopology(channel: Channel): Promise<void> {
  await channel.assertExchange(DLQ_EXCHANGE, 'direct', { durable: true });
  await channel.assertQueue(DLQ_QUEUE, { durable: true });
  await channel.bindQueue(DLQ_QUEUE, DLQ_EXCHANGE, DLQ_QUEUE);

  for (const q of RETRY_DELAY_QUEUES) {
    await channel.assertQueue(q.name, {
      durable: true,
      arguments: {
        'x-message-ttl': q.ttl,
        'x-dead-letter-exchange': TRANSFER_EXCHANGE,
        'x-dead-letter-routing-key': 'transfer.initiated',
      },
    });
  }
}
