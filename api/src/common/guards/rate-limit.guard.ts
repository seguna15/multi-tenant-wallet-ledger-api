import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { REDIS_CLIENT } from '@common/redis/redis.constants';
import { TooManyRequestsException } from '@common/exceptions/too-many-requests.exception';
import {
  RATE_LIMIT_KEY,
  RateLimitOptions,
  SKIP_RATE_LIMIT_KEY,
} from '../decorators/rate-limit.decorator';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Atomically: drop entries outside the window, count what's left, and either
// reject (returning retry-after) or admit the request by adding it to the set.
const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, 0, now - window)

local count = redis.call('ZCARD', key)
if count >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retryAfter = window
  if oldest[2] then
    retryAfter = (tonumber(oldest[2]) + window) - now
  end
  return { 0, retryAfter }
end

redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, window)
return { 1, 0 }
`;

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);
  private readonly defaultLimit: number;
  private readonly defaultWindowMs: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly reflector: Reflector,
    config: ConfigService,
  ) {
    this.defaultLimit = config.get<number>('RATE_LIMIT_MAX', 100);
    this.defaultWindowMs = config.get<number>('RATE_LIMIT_WINDOW_MS', 60_000);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handler = context.getHandler();
    const klass = context.getClass();

    const skip = this.reflector.getAllAndOverride<boolean>(
      SKIP_RATE_LIMIT_KEY,
      [handler, klass],
    );
    if (skip) return true;

    const request = context.switchToHttp().getRequest<Request>();
    if (!WRITE_METHODS.has(request.method)) return true;

    const options = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_KEY,
      [handler, klass],
    ) ?? { limit: this.defaultLimit, windowMs: this.defaultWindowMs };

    const key = this.buildKey(request);
    const now = Date.now();
    const member = `${now}-${randomUUID()}`;

    let allowed: number;
    let retryAfterMs: number;

    try {
      [allowed, retryAfterMs] = (await this.redis.eval(
        SLIDING_WINDOW_SCRIPT,
        1,
        key,
        now,
        options.windowMs,
        options.limit,
        member,
      )) as [number, number];
    } catch (error) {
      this.logger.error({
        msg: 'Redis unavailable — rate limiter cannot enforce limits',
        error,
      });
      throw new ServiceUnavailableException(
        'Rate limiting service temporarily unavailable',
      );
    }

    if (allowed === 0) {
      throw new TooManyRequestsException(
        Math.max(1, Math.ceil(retryAfterMs / 1000)),
      );
    }

    return true;
  }

  // Identity = API key (tenant-scoped) falling back to IP for unauthenticated/public writes.
  private buildKey(request: Request): string {
    const apiKey = request.headers['x-api-key'] as string | undefined;
    const identity = apiKey ?? request.ip ?? 'unknown';
    const route = request.route?.path ?? request.path;
    return `ratelimit:${identity}:${request.method}:${route}`;
  }
}
