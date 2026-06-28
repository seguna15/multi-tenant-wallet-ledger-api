import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rateLimit';
export const SKIP_RATE_LIMIT_KEY = 'skipRateLimit';

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

// Per-route override of the default sliding window (e.g. tighter limits on sensitive writes).
export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);

// Opt a route out of rate limiting entirely (e.g. webhooks already protected upstream).
export const SkipRateLimit = () => SetMetadata(SKIP_RATE_LIMIT_KEY, true);
