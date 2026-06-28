import { Module } from '@nestjs/common';
import { PrismaModule } from '@common/database/prisma.module';
import { OutboxModule } from '@modules/outbox/outbox.module';
import { WebhookService } from './webhook.service';
import { NotificationConsumer } from './notification.consumer';

@Module({
  imports: [
    OutboxModule, // provides RABBITMQ_CHANNEL
    PrismaModule, // provides PrismaService for tenant webhook lookup
  ],
  providers: [WebhookService, NotificationConsumer],
})
export class NotificationModule {}
