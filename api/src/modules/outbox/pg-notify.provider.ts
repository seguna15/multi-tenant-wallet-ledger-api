import { Logger, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'pg';
import { PG_NOTIFY_CLIENT } from '@modules/outbox/rabbitmq.constants';

export const pgNotifyClientProvider: Provider = {
  provide: PG_NOTIFY_CLIENT,
  inject: [ConfigService],
  useFactory: async (config: ConfigService): Promise<Client> => {
    const logger = new Logger('PgNotifyClient');
    const client = new Client({
      connectionString: config.get<string>('DB_URL'),
    });

    await client.connect();

    client.on('error', (err) =>
      logger.error({ msg: 'pg notify client error', err }),
    );

    logger.log('pg LISTEN client connected');
    return client;
  },
};
