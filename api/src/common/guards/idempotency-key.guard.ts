import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { REQUIRE_IDEMPOTENCY_KEY } from '@common/decorators/require-idempotency-key.decorator';

@Injectable()
export class IdempotencyKeyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_IDEMPOTENCY_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const key = request.headers['idempotency-key'] as string | undefined;

    if (!key?.trim()) {
      throw new BadRequestException(
        'The Idempotency-Key header is required for this endpoint',
      );
    }

    return true;
  }
}
