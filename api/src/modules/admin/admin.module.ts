import { Module } from '@nestjs/common';
import { AdminController } from '@modules/admin/admin.controller';
import { TenantModule } from '@modules/tenant/tenant.module';

@Module({
  imports: [TenantModule], // re-uses TenantService + TenantRepository already exported
  controllers: [AdminController],
})
export class AdminModule {}
