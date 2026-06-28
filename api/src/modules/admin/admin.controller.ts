import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma-client';
import { UserClsGuard } from '@common/guards/user-cls.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { TenantService } from '@modules/tenant/tenant.service';
import { CreateTenantDto } from '@modules/tenant/dto';
import { AdminJwtAuthGuard } from '@common/guards/admin-jwt-auth.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { TENANT_ADMIN_GUARDS } from '@modules/tenant/tenant.controller';

@ApiTags('Admin — Tenants')
@Controller('admin/tenants')
@UseGuards(AdminJwtAuthGuard, UserClsGuard, RolesGuard)
@Roles(UserRole.SYSTEM_ADMIN)
@ApiForbiddenResponse({ description: 'SYSTEM_ADMIN role required' })
export class AdminController {
  constructor(private readonly tenantService: TenantService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all tenants (SYSTEM_ADMIN only)' })
  @ApiOkResponse({ description: 'Array of all tenants' })
  getAllTenants() {
    return this.tenantService.getAllTenants();
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a single tenant by ID (SYSTEM_ADMIN only)' })
  @ApiOkResponse({ description: 'Tenant record' })
  getTenantById(@Param('id') id: string) {
    return this.tenantService.getTenantById(id);
  }

  @Get(':id/stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get aggregate stats for a tenant (SYSTEM_ADMIN only)',
  })
  @ApiOkResponse({
    description: 'Wallet/user/transfer/DLQ counts for the tenant',
  })
  getTenantStats(@Param('id') id: string) {
    return this.tenantService.getTenantStats(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new tenant (SYSTEM_ADMIN only)' })
  @ApiCreatedResponse({ description: 'Tenant created — API key returned once' })
  createTenant(@Body() dto: CreateTenantDto) {
    return this.tenantService.createSingleTenant(dto);
  }

  @Patch(':id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle tenant activation (SYSTEM_ADMIN only)' })
  @ApiOkResponse({ description: 'Activation status toggled' })
  toggleActivation(@Param('id') id: string) {
    return this.tenantService.toggleTenantActivation(id);
  }
}
