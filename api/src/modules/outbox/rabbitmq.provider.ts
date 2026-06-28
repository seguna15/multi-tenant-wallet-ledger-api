import { Logger, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqplib from 'amqplib';
import {
  NOTIFICATION_QUEUE,
  RABBITMQ_CHANNEL,
  TRANSFER_COMPLETED_QUEUE,
  TRANSFER_EXCHANGE,
  TRANSFER_QUEUE,
} from '@modules/outbox/rabbitmq.constants';

export const rabbitmqChannelProvider: Provider = {
  provide: RABBITMQ_CHANNEL,
  inject: [ConfigService],
  useFactory: async (config: ConfigService) => {
    const logger = new Logger('RabbitMQProvider');
    const url = config.get<string>('RABBITMQ_URL', 'amqp://localhost');

    const connection = await amqplib.connect(url);
    const channel = await connection.createChannel();

    await channel.assertExchange(TRANSFER_EXCHANGE, 'topic', { durable: true });
    await channel.assertQueue(TRANSFER_QUEUE, { durable: true });
    await channel.assertQueue(NOTIFICATION_QUEUE, { durable: true });
    await channel.assertQueue(TRANSFER_COMPLETED_QUEUE, { durable: true });


    await channel.bindQueue(TRANSFER_QUEUE, TRANSFER_EXCHANGE, 'transfer.initiated');
    await channel.bindQueue(NOTIFICATION_QUEUE, TRANSFER_EXCHANGE, 'transfer.*');
    await channel.bindQueue(
      TRANSFER_COMPLETED_QUEUE,
      TRANSFER_EXCHANGE,
      'transfer.completed',
    );

    connection.on('error', (err) =>
      logger.error({ msg: 'RabbitMQ connection error', err }),
    );
    connection.on('close', () =>
      logger.warn('RabbitMQ connection closed unexpectedly'),
    );

    logger.log('RabbitMQ channel ready');
    return channel;
  },
};
