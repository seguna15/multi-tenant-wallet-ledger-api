import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Tenant } from "@prisma-client";

export const CurrentTenant = createParamDecorator(
    (field: keyof Tenant | undefined, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        const tenant: Tenant = request.user;
        return field ? tenant?.[field] : tenant;
    }
) 