import { Module } from '@nestjs/common';
import { LedgerModule } from '@modules/ledger/ledger.module';
import { WalletModule } from '@modules/wallet/wallet.module';
import { TransferController } from '@modules/transfer/transfer.controller';
import { TransferRepository } from '@modules/transfer/transfer.repository';
import { TransferService } from '@modules/transfer/transfer.service';
import { FxRateService } from '@modules/transfer/fx-rate.service';
import { TransferAdminController } from '@modules/transfer/transfer.admin.controller';

@Module({
  imports: [WalletModule, LedgerModule],
  controllers: [TransferController, TransferAdminController],
  providers: [TransferService, TransferRepository, FxRateService],
  exports: [TransferService],
})
export class TransferModule {}
