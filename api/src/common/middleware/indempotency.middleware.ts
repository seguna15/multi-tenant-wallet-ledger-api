import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { NextFunction, Request, Response } from 'express';
import { safeStringify } from '@common/utils/serialize';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 h
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH']);

interface CachedResponse {
  status: number;
  body: unknown;
}

@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const key = req.headers['idempotency-key'] as string | undefined;

    if (!key || !WRITE_METHODS.has(req.method)) {
      return next();
    }

    const cacheKey = `idempotency:${key}`;
    const cached = await this.cache.get<CachedResponse>(cacheKey);

    if (cached) {
      res.setHeader('x-idempotency-cache', 'HIT');
      res.status(cached.status).json(cached.body);
      return;
    }

    // Wrap res.json to capture the first successful response
    const originalJson = res.json.bind(res) as (body: unknown) => Response;
    res.json = (body: unknown): Response => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // safeStringify + JSON.parse round-trips BigInt fields as strings,
        // matching what the client receives and what keyv can serialize.
        const serializable = JSON.parse(safeStringify(body)) as unknown;
        void this.cache.set(
          cacheKey,
          { status: res.statusCode, body: serializable },
          IDEMPOTENCY_TTL_MS,
        );
      }
      return originalJson(body);
    };

    next();
  }
}
