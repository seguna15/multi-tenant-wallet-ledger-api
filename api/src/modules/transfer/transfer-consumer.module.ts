import { Module } from '@nestjs/common';
import { PrismaModule } from '@common/database/prisma.module';
import { OutboxModule } from '@modules/outbox/outbox.module';
import { TransferCompletedConsumer } from './consumers/transfer-completed.consumer';

@Module({
  imports: [
    OutboxModule, // provides RABBITMQ_CHANNEL
    PrismaModule, // provides PrismaService for status update
  ],
  providers: [TransferCompletedConsumer],
})
export class TransferConsumerModule {}
