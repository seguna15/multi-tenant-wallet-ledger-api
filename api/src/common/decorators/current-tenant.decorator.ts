import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Tenant } from "@prisma-client";

export const CurrentTenant = createParamDecorator(
    (field: keyof Tenant | undefined, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        // request.tenant is set by TenantClsGuard before JwtAuthGuard can
        // overwrite request.user with the JWT RequestUser payload
        const tenant: Tenant = request.tenant ?? request.user;
        return field ? tenant?.[field] : tenant;
    }
)