import { TenantStore } from '@common/cls/tenant-store.interface';
import { TenantRepository } from '@modules/tenant/tenant.repository';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Tenant, TenantType } from '@prisma-client';
import { hashApiKey, verifyApiKey } from '@shared/utils/api-key.util';
import { ClsService } from 'nestjs-cls';
import { Logger } from 'nestjs-pino';
import { HeaderAPIKeyStrategy } from 'passport-headerapikey';

@Injectable()
export class AdminKeyStrategy extends PassportStrategy(
  HeaderAPIKeyStrategy,
  'admin-key',
) {
  constructor(
    private readonly clsService: ClsService<TenantStore>,
    private readonly tenantRepository: TenantRepository,
    private readonly logger: Logger,
  ) {
    super({ header: 'x-admin-key', prefix: '' }, false);
  }

  async validate(apiKey: string): Promise<Tenant> {
    const keyHash = await hashApiKey(apiKey);
    const tenant = await this.tenantRepository.findByApiKeyHash(keyHash);

    if (!tenant || !tenant.isActive || !verifyApiKey(apiKey, tenant.apiKeyHash)) {
      throw new UnauthorizedException('Invalid or inactive admin key');
    }

    if (tenant.apiKeyExpiresAt && tenant.apiKeyExpiresAt < new Date()) {
      throw new UnauthorizedException('Admin key has expired');
    }

    if (tenant.type !== TenantType.SYSTEM) {
      throw new UnauthorizedException('Forbidden: not a system tenant');
    }

    this.clsService.set('tenantId', tenant.id);

    this.tenantRepository.updateApiKeyLastUsedAt(tenant.id).catch(() => {
      this.logger.warn(
        `Failed to update last used timestamp for system tenant ${tenant.id}`,
      );
    });

    return tenant;
  }
}
