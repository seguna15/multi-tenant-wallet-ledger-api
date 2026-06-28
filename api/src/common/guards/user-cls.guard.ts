import { TenantStore } from "@common/cls/tenant-store.interface";
import { RequestUser } from "@modules/auth/types/auth.types";
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { UserRole } from "@prisma-client";
import { ClsService } from "nestjs-cls";


@Injectable()
export class UserClsGuard implements CanActivate { 
    constructor(private readonly clsService: ClsService<TenantStore>) {}

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const user: RequestUser = request.user; //populated by passport-jwt


        // When ApiKeyGuard + TenantClsGuard ran first, tenantId is already in CLS.
        // Reject any JWT whose tenantId doesn't match the API key's tenant.
        const clsTenantId = this.clsService.get('tenantId');
        if (clsTenantId && user.tenantId !== clsTenantId) {
        throw new ForbiddenException('Token tenant mismatch');
        }
        
        // Dashboard flow: no ApiKeyGuard ran, seed tenantId from the JWT payload
        if (!clsTenantId) {
        this.clsService.set('tenantId', user.tenantId);
        }

        // SYSTEM_ADMIN bypasses row-level tenant scoping in BaseRepository
        if (user.role === UserRole.SYSTEM_ADMIN) {
        this.clsService.set('isGlobalAdmin', true);
        }

        this.clsService.set('userId', user.userId);
        this.clsService.set('userRole', user.role);
      
        return true;
    }
}
    