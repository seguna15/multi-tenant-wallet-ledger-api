import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
  Patch,
  UseGuards,
  Param,
  Get,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { TenantService } from '@modules/tenant/tenant.service';
import { CreateTenantDto, UpdateTenantDto } from '@modules/tenant/dto';
import { RotateTenantWebhookSecretResult } from '@modules/tenant/types/tenant.types';
import { RolesGuard } from '@common/guards/roles.guard';
import { UserClsGuard } from '@common/guards/user-cls.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentTenant } from '@common/decorators/current-tenant.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { UserRole } from '@prisma-client';
import { AdminJwtAuthGuard } from '@common/guards/admin-jwt-auth.guard';

export const TENANT_ADMIN_GUARDS = [
  AdminJwtAuthGuard,
  UserClsGuard,
  RolesGuard,
] as const;

@ApiTags('Tenants')
@Controller('tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  // ─── TENANT_ADMIN routes — JWT cookie only, no API key required ───

  @Get('me')
  @UseGuards(...TENANT_ADMIN_GUARDS)
  @Roles(UserRole.TENANT_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current tenant profile' })
  @ApiOkResponse({ description: 'Tenant profile' })
  getCurrentTenant(@CurrentUser('tenantId') id: string) {
    return this.tenantService.getTenantProfile(id);
  }

  @Get('me/api-key')
  @UseGuards(...TENANT_ADMIN_GUARDS)
  @Roles(UserRole.TENANT_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get API key metadata' })
  @ApiOkResponse({ description: 'API key metadata' })
  getApiKeyMetadata(@CurrentUser('tenantId') id: string) {
    return this.tenantService.getApiKeyMetadata(id);
  }

  @Patch()
  @UseGuards(...TENANT_ADMIN_GUARDS)
  @Roles(UserRole.TENANT_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update tenant details' })
  @ApiOkResponse({ description: 'Tenant updated successfully' })
  updateSingleTenant(
    @CurrentUser('tenantId') id: string,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.tenantService.updateSingleTenant(id, dto);
  }

  @Delete()
  @UseGuards(...TENANT_ADMIN_GUARDS)
  @Roles(UserRole.TENANT_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate tenant' })
  deleteSingleTenant(@CurrentUser('tenantId') id: string) {
    return this.tenantService.softDeleteSingleTenant(id);
  }

  @Post('rotate-api-key')
  @UseGuards(...TENANT_ADMIN_GUARDS)
  @Roles(UserRole.TENANT_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate tenant API key' })
  @ApiOkResponse({
    description: 'New API key returned once — store immediately',
  })
  rotateTenantApiKey(@CurrentUser('tenantId') id: string) {
    return this.tenantService.rotateTenantApiKey(id);
  }

  @Post('rotate-webhook-secret')
  @UseGuards(...TENANT_ADMIN_GUARDS)
  @Roles(UserRole.TENANT_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate webhook secret' })
  @ApiOkResponse({
    description: 'New webhook secret returned once — store immediately',
  })
  rotateWebhookSecret(
    @CurrentUser('tenantId') id: string,
  ): Promise<RotateTenantWebhookSecretResult> {
    return this.tenantService.rotateTenantWebhookSecret(id);
  }
}
