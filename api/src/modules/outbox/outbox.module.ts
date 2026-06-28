import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { RABBITMQ_CHANNEL } from '@modules/outbox/rabbitmq.constants';
import { rabbitmqChannelProvider } from './rabbitmq.provider';
import { OutboxRepository } from '@modules/outbox/outbox.repository';
import { OutboxWorker } from '@modules/outbox/outbox.worker';
import { pgNotifyClientProvider } from '@modules/outbox/pg-notify.provider';
import { PrismaModule } from '@common/database/prisma.module';
import { DlqPersistService } from '@modules/outbox/dlq-persist.service';
import { QueueHealthService } from '@modules/outbox/queue-health.service';
import { DlqAdminController } from '@modules/outbox/dlq-admin.controller';
import { DlqService } from '@modules/outbox/dlq.service';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule],
  controllers: [DlqAdminController],
  providers: [rabbitmqChannelProvider, OutboxRepository, OutboxWorker, pgNotifyClientProvider, DlqPersistService,QueueHealthService, DlqService],
  exports: [RABBITMQ_CHANNEL,DlqPersistService, DlqService],
})
export class OutboxModule {}
