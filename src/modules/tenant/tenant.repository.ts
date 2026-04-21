import { TenantStore } from "@common/cls/tenant-store.interface";
import { PrismaService } from "@common/database/prisma.service";
import { BaseRepository } from "@common/repositories/base.repository";
import { Injectable } from "@nestjs/common";
import { Prisma, Tenant } from "@prisma-client";
import { ClsService } from "nestjs-cls";



@Injectable()
export class TenantRepository extends BaseRepository {
  constructor(prisma: PrismaService, cls: ClsService<TenantStore>) {
    super(prisma, cls);
  }

  createSingleTenant(data: Prisma.TenantCreateInput): Promise<Tenant> {
    return this.prisma.tenant.create({ data });
  }

  findSingleTenant(id: string): Promise<Tenant | null> {
    return this.prisma.tenant.findUnique({
      where: { id },
    });
  }

  findByApiKeyHash(hashedKey: string): Promise<Tenant | null> {
    return this.prisma.tenant.findUnique({
      where: { apiKeyHash: hashedKey },
    });
  }

  async updateSingleTenant(
    id: string,
    data: Prisma.TenantUpdateInput,
  ): Promise<Tenant> {
    return this.prisma.tenant.update({
      where: { id },
      data,
    });
  }

  softDeleteSingleTenant(id: string): Promise<Tenant> {
    return this.prisma.tenant.update({
      where: { id },
      data: { isActive: false },
    });
  }

  updateApiKeyLastUsedAt(id: string): Promise<Tenant> {
    return this.prisma.tenant.update({
      where: { id },
      data: { apiKeyLastUsedAt: new Date() },
    });
  }

  rotateApiKey(
    id: string,
    newApiKeyHash: string,
    expireAt: Date,
  ): Promise<Tenant> {
    return this.prisma.tenant.update({
      where: { id },
      data: {
        apiKeyHash: newApiKeyHash,
        apiKeyExpiresAt: expireAt,
        apiKeyLastUsedAt: null,
      },
    });
  }

  rotateWebhookSecret(id: string, newSecret: string): Promise<Tenant> {
    return this.prisma.tenant.update({
      where: { id },
      data: { webhookSecret: newSecret },
    });
  }

  activateSingleTenant(id: string): Promise<Tenant> {
    return this.prisma.tenant.update({
      where: { id },
      data: { isActive: true },
    });
  }
}