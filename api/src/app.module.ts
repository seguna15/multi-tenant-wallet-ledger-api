import { TenantStore } from '@common/cls/tenant-store.interface';
import { PrismaModule } from '@common/database/prisma.module';
import { CorrelationIdMiddleware } from '@common/middleware/correlation-id.middleware';
import { AuthModule } from '@modules/auth/auth.module';
import { TenantModule } from '@modules/tenant/tenant.module';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import KeyvRedis from '@keyv/redis';
import {  ClsModule, ClsService } from 'nestjs-cls';
import { LoggerModule } from 'nestjs-pino';
import { WalletModule } from '@modules/wallet/wallet.module';
import { LedgerModule } from '@modules/ledger/ledger.module';
import { TransferModule } from '@modules/transfer/transfer.module';
import { IdempotencyMiddleware } from '@common/middleware/indempotency.middleware';
import { OutboxModule } from '@modules/outbox/outbox.module';
import { LedgerConsumerModule } from '@modules/ledger/ledger-consumer.module';
import { NotificationModule } from '@modules/notification/notification.module';
import { TransferConsumerModule } from '@modules/transfer/transfer-consumer.module';
import { HealthModule } from '@modules/health/health.module';
import { AdminModule } from '@modules/admin/admin.module';
// app.module.ts
import { EventEmitterModule } from '@nestjs/event-emitter';
import { RedisModule } from '@common/redis/redis.module';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { RateLimitGuard } from '@common/guards/rate-limit.guard';
import { AllExceptionsFilter } from '@common/filters/all-exceptions.filter';



@Module({
  imports: [
    RedisModule,
    PrismaModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const host = config.get<string>('REDIS_HOST', 'localhost');
        const port = config.get<number>('REDIS_PORT', 6379);
        const password = config.get<string>('REDIS_PASSWORD');

        const redisUrl = password
          ? `redis://:${password}@${host}:${port}`
          : `redis://${host}:${port}`;

        return {
          stores: [new KeyvRedis(redisUrl)],
        };
      },
    }),
    LoggerModule.forRootAsync({
      inject: [ClsService],
      useFactory: (cls: ClsService<TenantStore>) => ({
        pinoHttp: {
          transport:
            process.env.NODE_ENV === 'development'
              ? { target: 'pino-pretty' }
              : undefined,
          autoLogging: true,
          redact: [
            'req.headers.authorization',
            'req.headers["x-api-key"]',
            'req.headers["x-admin-key"]',
            'req.headers[cookie]',
            'res.headers["set-cookie"]',
          ],
          mixin: () => ({
            correlationId: cls.get('correlationId'),
            tenantId: cls.get('tenantId'),
          }),
        },
      }),
    }),
    ClsModule.forRoot({
      global: true, // cls module will be available globally without needing to import it in other modules
      middleware: {
        mount: true, // automatically mount middleware to set up CLS context for each request
      },
    }),
    EventEmitterModule.forRoot(),
    AdminModule,
    TenantModule,
    AuthModule,
    WalletModule,
    LedgerModule,
    TransferModule,
    OutboxModule,
    LedgerConsumerModule,
    TransferConsumerModule,
    NotificationModule,
    HealthModule,
  ],
  controllers: [],
  providers: [
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CorrelationIdMiddleware, IdempotencyMiddleware)
      .forRoutes('*path');
  }
}
