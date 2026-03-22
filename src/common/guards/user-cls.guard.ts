import { TenantStore } from "@common/cls/tenant-store.interface";
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { User } from "@prisma/client";
import { ClsService } from "nestjs-cls";


@Injectable()
export class UserClsGuard implements CanActivate { 
    constructor(private readonly clsService: ClsService<TenantStore>) {}

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const user: User = request.user; //populated by passport-jwt

        this.clsService.set('userId', user.id);
        
        return true;
    }
}
    