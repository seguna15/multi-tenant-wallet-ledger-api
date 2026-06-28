import { TenantStore } from '@common/cls/tenant-store.interface';
import { TenantRepository } from '@modules/tenant/tenant.repository';
import {Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Tenant } from '@prisma-client';
import { hashApiKey, verifyApiKey } from '@shared/utils/api-key.util';
import { ClsService } from 'nestjs-cls';
import { Logger } from 'nestjs-pino';
import { HeaderAPIKeyStrategy } from 'passport-headerapikey';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(
  HeaderAPIKeyStrategy,
  'headerapikey',
) {
  constructor(
    private readonly clsService: ClsService<TenantStore>,
    private readonly tenantRepository: TenantRepository,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly logger: Logger,
  ) {
    super({ header: 'x-api-key', prefix: '' }, false);
  }

  async validate(apiKey: string): Promise<Tenant> {
    const keyHash = await hashApiKey(apiKey);
    const cacheKey = `apikey:${keyHash}`;

    let tenant: Tenant | null | undefined = await this.cache.get<Tenant>(cacheKey);

    if (!tenant) {
      tenant = await this.tenantRepository.findByApiKeyHash(keyHash);
      if (tenant) await this.cache.set(cacheKey, tenant, 5 * 60 * 1000); // 5 min TTL
    }

    if (
      !tenant ||
      !tenant.isActive ||
      !verifyApiKey(apiKey, tenant.apiKeyHash)
    ) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }

    if (tenant.apiKeyExpiresAt && tenant.apiKeyExpiresAt < new Date()) {
      throw new UnauthorizedException('API key has expired');
    }

    this.clsService.set('tenantId', tenant.id);
    this.tenantRepository.updateApiKeyLastUsedAt(tenant.id).catch(() => {
      this.logger.warn(
        `Failed to update last used timestamp for tenant ${tenant!.id}`,
      );
    });

    return tenant;
  }
}
