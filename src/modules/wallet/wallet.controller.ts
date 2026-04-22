import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { ApiKeyGuard } from '@common/guards/api-key.guard';
import { TenantClsGuard } from '@common/guards/tenant-cls.guard';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { UserClsGuard } from '@common/guards/user-cls.guard';
import { WalletService } from '@modules/wallet/wallet.service';
import { CreateWalletDto, ListWalletsQueryDto } from '@modules/wallet/dto';

@ApiTags('Wallets')
@ApiSecurity('x-api-key')
@UseGuards(ApiKeyGuard, TenantClsGuard)
@Controller('wallets')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post()
  @UseGuards(JwtAuthGuard, UserClsGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a wallet for a user scoped to the tenant' })
  @ApiCreatedResponse({ description: 'Wallet created successfully' })
  createWallet(@Body() dto: CreateWalletDto) {
    return this.walletService.createWallet(dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List wallets for the tenant (cursor-paginated)' })
  @ApiOkResponse({ description: 'Paginated wallet list with nextCursor' })
  listWallets(@Query() query: ListWalletsQueryDto) {
    return this.walletService.listWallets(query);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, UserClsGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "List the authenticated user's wallets (cursor-paginated)" })
  @ApiOkResponse({ description: 'Paginated list of wallets belonging to the current user' })
  listMyWallets(@Query() query: ListWalletsQueryDto) {
    return this.walletService.listMyWallets(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, UserClsGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get wallet details by ID' })
  @ApiOkResponse({ description: 'Wallet details' })
  getWallet(@Param('id') id: string) {
    return this.walletService.getWallet(id);
  }

  @Get(':id/balance')
  @UseGuards(JwtAuthGuard, UserClsGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get wallet balance (Redis-cached, 60s TTL)' })
  @ApiOkResponse({ description: 'Wallet balance' })
  getBalance(@Param('id') id: string) {
    return this.walletService.getBalance(id);
  }
}
