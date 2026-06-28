import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma-client';
import { WalletService } from './wallet.service';
import { ListWalletsQueryDto } from '@modules/wallet/dto';
import { AdminJwtAuthGuard } from '@common/guards/admin-jwt-auth.guard';
import { UserClsGuard } from '@common/guards/user-cls.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';

@ApiTags('Admin — Wallets')
@Controller('admin/wallets')
@UseGuards(AdminJwtAuthGuard, UserClsGuard, RolesGuard)
@Roles(UserRole.TENANT_ADMIN)
@ApiForbiddenResponse({ description: 'TENANT_ADMIN role required' })
export class WalletAdminController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List all wallets for the tenant — used by the dashboard',
  })
  @ApiOkResponse({ description: 'Cursor-paginated wallet list across the tenant' })
  listWallets(@Query() query: ListWalletsQueryDto) {
    return this.walletService.listWallets(query);
  }
}
