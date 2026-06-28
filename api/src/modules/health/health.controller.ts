// src/modules/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { DatabaseHealthIndicator } from '@modules/health/indicators/database.health';
import { CacheHealthIndicator } from '@modules/health/indicators/cache.health';
import { QueueHealthIndicator } from '@modules/health/indicators/queue.health';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: DatabaseHealthIndicator,
    private readonly cache: CacheHealthIndicator,
    private readonly queue: QueueHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.isHealthy('db'),
      () => this.cache.isHealthy('cache'),
      () => this.queue.isHealthy('queue'),
    ]);
  }

  @Get('db')
  @HealthCheck()
  checkDb() {
    return this.health.check([() => this.db.isHealthy('db')]);
  }

  @Get('cache')
  @HealthCheck()
  checkCache() {
    return this.health.check([() => this.cache.isHealthy('cache')]);
  }

  @Get('queue')
  @HealthCheck()
  checkQueue() {
    return this.health.check([() => this.queue.isHealthy('queue')]);
  }
}
