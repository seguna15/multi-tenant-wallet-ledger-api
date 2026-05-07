import { Module } from '@nestjs/common';
import { LedgerModule } from '@modules/ledger/ledger.module';
import { WalletModule } from '@modules/wallet/wallet.module';
import { TransferController } from '@modules/transfer/transfer.controller';
import { TransferRepository } from '@modules/transfer/transfer.repository';
import { TransferService } from '@modules/transfer/transfer.service';

@Module({
  imports: [WalletModule, LedgerModule],
  controllers: [TransferController],
  providers: [TransferService, TransferRepository],
  exports: [TransferService],
})
export class TransferModule {}
