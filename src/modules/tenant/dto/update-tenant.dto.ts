import { PartialType } from "@nestjs/swagger";
import { CreateTenantDto } from "@modules/tenant/dto/create-tenant.dto";


export class UpdateTenantDto  extends PartialType(CreateTenantDto) {}