import { Module } from '@nestjs/common';
import { LedgerModule } from '@modules/ledger/ledger.module';
import { OutboxModule } from '@modules/outbox/outbox.module';
import { PrismaModule } from '@common/database/prisma.module';
import { TransferInitiatedConsumer } from '@modules/ledger/consumers/transfer-initiated.consumer';

@Module({
  imports: [
    LedgerModule, // provides LedgerService
    OutboxModule, // provides RABBITMQ_CHANNEL
    PrismaModule, // provides PrismaService for direct transfer status update
  ],
  providers: [TransferInitiatedConsumer],
})
export class LedgerConsumerModule {}
