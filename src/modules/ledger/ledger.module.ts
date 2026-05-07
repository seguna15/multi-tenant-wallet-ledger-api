import { forwardRef, Module } from '@nestjs/common';
import { LedgerController } from '@modules/ledger/ledger.controller';
import { LedgerService } from '@modules/ledger/ledger.service';
import { LedgerRepository } from '@modules/ledger/ledger.repository';
import { WalletModule } from '@modules/wallet/wallet.module';

@Module({
  imports: [forwardRef(() => WalletModule)],
  controllers: [LedgerController],
  providers: [LedgerService, LedgerRepository],
  exports: [LedgerService], // exported so TransferModule and wallet module can call getBalance and writeJournalEntries
})
export class LedgerModule {}
