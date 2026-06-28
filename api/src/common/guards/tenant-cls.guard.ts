import { TenantStore } from "@common/cls/tenant-store.interface";
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Tenant } from "@prisma-client";
import { ClsService } from "nestjs-cls";

@Injectable()
export class TenantClsGuard implements CanActivate {
  constructor(private readonly clsService: ClsService<TenantStore>) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const tenant: Tenant | undefined = request.user;

    // ApiKeyGuard was skipped (e.g. SSE route) — UserClsGuard seeds tenantId from the JWT
    if (!tenant) return true;

    // Preserve tenant before JwtAuthGuard overwrites request.user with RequestUser
    request.tenant = tenant;

    this.clsService.set('tenantId', tenant.id);
    this.clsService.set('isGlobalAdmin', false);

    return true;
  }
}