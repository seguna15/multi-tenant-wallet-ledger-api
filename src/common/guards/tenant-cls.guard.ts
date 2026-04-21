import { TenantStore } from "@common/cls/tenant-store.interface";
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Tenant } from "@prisma-client";
import { ClsService } from "nestjs-cls";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";

@Injectable()
export class TenantClsGuard implements CanActivate {
  constructor(
    private readonly clsService: ClsService<TenantStore>,
    @InjectPinoLogger(TenantClsGuard.name)
    private readonly logger: PinoLogger,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const tenant: Tenant = request.user;

    this.clsService.set('tenantId', tenant.id);
    this.clsService.set('isGlobalAdmin', false);
    this.logger.assign({ tenantId: tenant.id });

    return true;
  }
}