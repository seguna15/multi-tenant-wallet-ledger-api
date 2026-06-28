import { ExecutionContext, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Reflector } from "@nestjs/core";
import { SKIP_API_KEY_KEY } from "@common/decorators/skip-api-key.decorator";


@Injectable()
export class ApiKeyGuard extends AuthGuard('headerapikey') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_API_KEY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skip) return true;

    return super.canActivate(context);
  }
}
