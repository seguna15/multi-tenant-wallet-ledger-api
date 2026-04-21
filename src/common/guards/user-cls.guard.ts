import { TenantStore } from "@common/cls/tenant-store.interface";
import { RequestUser } from "@modules/auth/types/auth.types";
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { ClsService } from "nestjs-cls";


@Injectable()
export class UserClsGuard implements CanActivate { 
    constructor(private readonly clsService: ClsService<TenantStore>) {}

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const user: RequestUser = request.user; //populated by passport-jwt

        this.clsService.set('userId', user.userId);
      
        return true;
    }
}
    