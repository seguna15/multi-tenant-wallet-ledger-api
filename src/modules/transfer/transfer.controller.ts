import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
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
import { CreateTransferDto } from '@modules/transfer/dto';
import { TransferService } from '@modules/transfer/transfer.service';

@ApiTags('Transfers')
@ApiSecurity('x-api-key')
@UseGuards(ApiKeyGuard, TenantClsGuard)
@Controller('transfers')
export class TransferController {
  constructor(private readonly transferService: TransferService) {}

  @Post()
  @UseGuards(JwtAuthGuard, UserClsGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Initiate a transfer between two tenant-owned wallets',
  })
  @ApiCreatedResponse({
    description: 'Transfer created with INITIATED status + outbox event',
  })
  createTransfer(@Body() dto: CreateTransferDto) {
    return this.transferService.createTransfer(dto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, UserClsGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Fetch transfer by ID with current status' })
  @ApiOkResponse({ description: 'Transfer details' })
  getTransfer(@Param('id') id: string) {
    return this.transferService.getTransfer(id);
  }
}
