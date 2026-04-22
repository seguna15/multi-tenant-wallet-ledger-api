import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { AdminGuard } from '@common/guards/admin.guard';
import { WalletService } from './wallet.service';
import { ListWalletsQueryDto } from '@modules/wallet/dto';

@ApiTags('Admin - Wallets')
@ApiSecurity('x-admin-key')
@UseGuards(AdminGuard)
@Controller('admin/wallets')
export class WalletAdminController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin: list all wallets across all tenants' })
  @ApiOkResponse({ description: 'Paginated wallet list across all tenants' })
  listAllWallets(
    @Query() query: ListWalletsQueryDto
  ) {
    return this.walletService.listAllWallets(query);
  }
}
