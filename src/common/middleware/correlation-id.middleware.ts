import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ClsService } from 'nestjs-cls';
import { randomUUID } from 'crypto';
import { TenantStore } from '@common/cls/tenant-store.interface';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  constructor(private readonly cls: ClsService<TenantStore>) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId =
      (req.headers['x-correlation-id'] as string) ?? randomUUID();

    this.cls.set('correlationId', correlationId);
    res.setHeader('x-correlation-id', correlationId);
    next();
  }
}
