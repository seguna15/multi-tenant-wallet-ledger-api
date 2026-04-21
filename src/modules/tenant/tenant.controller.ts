import { Body, Controller, Delete, HttpCode, HttpStatus, Post, Patch, UseGuards, Param } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { TenantService } from "@modules/tenant/tenant.service";
import { CreateTenantDto, UpdateTenantDto } from "@modules/tenant/dto";
import { TenantClsGuard } from "@common/guards/tenant-cls.guard";
import { RotateTenantWebhookSecretResult } from "@modules/tenant/types/tenant.types";
import { ApiKeyGuard } from "@common/guards/api-key.guard";
import { CurrentTenant } from "@common/decorators/current-tenant.decorator";
import { AdminGuard } from "@common/guards/admin.guard";



@ApiTags('Tenants')
@Controller('tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post()
  @ApiOperation({
    summary: 'Register a new tenant',
    description:
      'Returns the API key once.. It cannot be retrieved again. Store it immediately',
  })
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({
    description: 'Tenant registered api key returned once',
  })
  async registerSingleTenant(@Body() dto: CreateTenantDto) {
    return this.tenantService.createSingleTenant(dto);
  }

  @Patch()
  @UseGuards(ApiKeyGuard, TenantClsGuard)
  @ApiSecurity('x-api-key')
  @ApiOperation({
    summary: 'Update tenant details',
    description:
      'Updates the authenticated tenant. Tenant is identified by API key — no ID needed in the URL.',
  })
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Tenant updated successfully' })
  async updateSingleTenant(
    @CurrentTenant('id') id: string,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.tenantService.updateSingleTenant(id, dto);
  }

  @Delete()
  @UseGuards(ApiKeyGuard, TenantClsGuard)
  @ApiSecurity('x-api-key')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Deactivate tenant',
    description:
      'Soft deletes the authenticated tenant. Tenant is identified by API key.',
  })
  async softDeleteSingleTenant(@CurrentTenant('id') id: string) {
    await this.tenantService.softDeleteSingleTenant(id);
  }

  @Post('rotate-api-key')
  @UseGuards(ApiKeyGuard, TenantClsGuard)
  @ApiSecurity('x-api-key')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate tenant API key',
    description:
      'Generates a new API key. The old key stops working immediately.',
  })
  @ApiOkResponse({
    description: 'New API key returned once — store it immediately.',
  })
  async rotateTenantApiKey(@CurrentTenant('id') id: string) {
    return this.tenantService.rotateTenantApiKey(id);
  }

  @Post('rotate-webhook-secret')
  @UseGuards(ApiKeyGuard, TenantClsGuard)
  @ApiSecurity('x-api-key')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Rotate webhook secret — invalidates current secret, returns new one once',
  })
  @ApiOkResponse({
    description:
      'New webhook secret returned. Store it immediately — it cannot be retrieved again.',
  })
  async rotateWebhookSecret(
    @CurrentTenant('id') id: string,
  ): Promise<RotateTenantWebhookSecretResult> {
    return this.tenantService.rotateTenantWebhookSecret(id);
  }

  @Patch(':id/activate')
  @UseGuards(AdminGuard)
  @ApiSecurity('x-admin-key')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reactivate a soft-deleted tenant',
    description: 'Admin-only. Pass the admin key in the x-admin-key header.',
  })
  @ApiOkResponse({ description: 'Tenant reactivated successfully' })
  async activateSingleTenant(@Param('id') id: string) {
    return this.tenantService.activateSingleTenant(id);
  }
}