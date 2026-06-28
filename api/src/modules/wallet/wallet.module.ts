import { forwardRef, Module } from '@nestjs/common';
import { WalletController } from '@modules/wallet/wallet.controller';
import { WalletAdminController } from '@modules/wallet/wallet.admin.controller';
import { WalletService } from '@modules/wallet/wallet.service';
import { WalletRepository } from '@modules/wallet/wallet.repository';
import { LedgerModule } from '@modules/ledger/ledger.module';

@Module({
  imports: [forwardRef(() => LedgerModule)],
  controllers: [WalletController, WalletAdminController],
  providers: [WalletService, WalletRepository],
  exports: [WalletService, WalletRepository],
})
export class WalletModule {}
