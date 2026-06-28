// src/modules/health/health.module.ts
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from '@modules/health/health.controller';
import { DatabaseHealthIndicator } from '@modules/health/indicators/database.health';
import { CacheHealthIndicator } from '@modules/health/indicators/cache.health';
import { QueueHealthIndicator } from '@modules/health/indicators/queue.health';
import { PrismaModule } from '@common/database/prisma.module';
import { OutboxModule } from '@modules/outbox/outbox.module';

@Module({
  imports: [TerminusModule, PrismaModule, OutboxModule],
  controllers: [HealthController],
  providers: [
    DatabaseHealthIndicator,
    CacheHealthIndicator,
    QueueHealthIndicator,
  ],
})
export class HealthModule {}
