import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { ApiKeyGuard } from '@common/guards/api-key.guard';
import { TenantClsGuard } from '@common/guards/tenant-cls.guard';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { UserClsGuard } from '@common/guards/user-cls.guard';
import { LedgerService } from './ledger.service';
import { ListJournalEntriesQueryDto } from './dto';

@ApiTags('Ledger')
@ApiSecurity('x-api-key')
@UseGuards(ApiKeyGuard, TenantClsGuard, JwtAuthGuard, UserClsGuard)
@Controller('ledger')
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Get(':walletId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List paginated journal entries for a wallet' })
  @ApiOkResponse({
    description: 'Cursor-paginated journal entries with nextCursor',
  })
  getJournalEntries(
    @Param('walletId') walletId: string,
    @Query() query: ListJournalEntriesQueryDto,
  ) {
    return this.ledgerService.getJournalEntries(walletId, query);
  }

  @Get(':walletId/balance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get wallet balance derived from journal entries' })
  @ApiOkResponse({
    description: 'Computed balance — never stored, always derived',
  })
  getBalance(@Param('walletId') walletId: string) {
    return this.ledgerService.getBalance(walletId);
  }
}
