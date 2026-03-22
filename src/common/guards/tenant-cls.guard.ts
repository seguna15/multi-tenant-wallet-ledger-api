import { TenantStore } from "@common/cls/tenant-store.interface";
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Tenant } from "@prisma/client";
import { ClsService } from "nestjs-cls";


@Injectable()
export class TenantClsGuard implements CanActivate {
  constructor(private readonly clsService: ClsService<TenantStore>) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const tenant: Tenant = request.user; //populated by passport-headerpapikey

    this.clsService.set('tenantId', tenant.id);
    this.clsService.set('isGlobalAdmin', false); // default to false for all requests, can be overridden by other guards
    
    return true;
  }
}