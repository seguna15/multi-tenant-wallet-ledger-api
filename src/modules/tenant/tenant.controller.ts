import { Body, Controller, Delete, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { TenantService } from "@modules/tenant/tenant.service";
import { CreateTenantDto, UpdateTenantDto } from "@modules/tenant/dto";
import { TenantClsGuard } from "@common/guards/tenant-cls.guard";


@ApiTags("Tenants")
@Controller("tenants")
export class TenantController {
   constructor(private readonly tenantService: TenantService) {}


   @Post()
   @ApiOperation({
    summary: 'Register a new tenant',
    description: 'Returns the API key once.. It cannot be retrieved again. Store it immediately'
   })
   @HttpCode(HttpStatus.CREATED)
   @ApiCreatedResponse({
    description: 'Tenant registered api key returned once',
    })
    async registerSingleTenant(
        @Body() dto: CreateTenantDto
    ) {
        return this.tenantService.createSingleTenant(dto);
    }

    @Patch(":id")
    @UseGuards(/*AuthGuard('headerapikey'),*/ TenantClsGuard )
    @ApiSecurity("x-api-key")
    @ApiOperation({
        summary: 'Update tenant details',
        description: 'Updates tenant details. API key cannot be updated via this endpoint'
    })
    @HttpCode(HttpStatus.OK)
    @ApiOkResponse({
        description: 'Tenant updated successfully',
    })
    async updateSingleTenant(
        @Param("id", ParseUUIDPipe) id: string,
        @Body() dto: UpdateTenantDto
    ) {
        // For simplicity we are not allowing API key rotation for now, but this could be implemented in the future if needed
        return this.tenantService.updateSingleTenant(id, dto);
    }

    @Delete(":id")
    @UseGuards(/*AuthGuard('headerapikey'),*/ TenantClsGuard )
    @ApiSecurity("x-api-key")
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary: 'Soft delete a tenant',
        description: 'Soft deletes a tenant by setting isActive to false. This allows us to keep historical data for the tenant while preventing any new activity.'
    })
    @ApiOkResponse({
        description: 'Tenant soft deleted successfully',
    })
    async softDeleteSingleTenant(
        @Param("id", ParseUUIDPipe) id: string,
    ) {
        await this.tenantService.softDeleteSingleTenant(id);
        return;
    }

    @Post(":id/rotate-api-key")
    @UseGuards(/*AuthGuard('headerapikey'),*/ TenantClsGuard )
    @ApiSecurity("x-api-key")
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Rotate tenant API key',
        description: 'Generates a new API key for the tenant. The old API key will no longer work immediately after rotation.'
    })
    @ApiOkResponse({
        description: 'Tenant API key rotated successfully, new API key returned',
    })
    async rotateTenantApiKey(
        @Param("id", ParseUUIDPipe) id: string,
    ) {
        return this.tenantService.rotateTenantApiKey(id);
    }
}