// src/modules/health/indicators/cache.health.ts
import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { Cache } from 'cache-manager';

@Injectable()
export class CacheHealthIndicator {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    const probe = '__health__';
    try {
      await this.cacheManager.set(probe, '1', 5000);
      const val = await this.cacheManager.get(probe);
      return val === '1' ? indicator.up() : indicator.down();
    } catch (error) {
      return indicator.down({ error: (error as Error).message });
    }
  }
}
