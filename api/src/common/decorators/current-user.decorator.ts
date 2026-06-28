import { RequestUser } from "@modules/auth/types/auth.types";
import {createParamDecorator, ExecutionContext } from "@nestjs/common";


export const CurrentUser = createParamDecorator(
    (field: keyof RequestUser | undefined, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        const user: RequestUser = request.user;
        return field ? user?.[field] : user;
    }
);