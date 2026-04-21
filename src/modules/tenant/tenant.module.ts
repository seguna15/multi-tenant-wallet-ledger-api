import { Module } from '@nestjs/common';
import { TenantRepository } from '@modules/tenant/tenant.repository';
import { TenantController } from '@modules/tenant/tenant.controller';
import { TenantService } from '@modules/tenant/tenant.service';
import { AdminGuard } from '@common/guards/admin.guard';

@Module({
    controllers: [TenantController],
    providers: [
        TenantService, 
        TenantRepository,
        AdminGuard,
    ],
    exports: [
        TenantService, 
        TenantRepository
    ]
})
export class TenantModule {
    
}
