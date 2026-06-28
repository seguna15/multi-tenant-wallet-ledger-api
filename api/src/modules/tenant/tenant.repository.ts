import { TenantStore } from "@common/cls/tenant-store.interface";
import { PrismaService } from "@common/database/prisma.service";
import { BaseRepository } from "@common/repositories/base.repository";
import { Injectable } from "@nestjs/common";
import { Prisma, Tenant } from "@prisma-client";
import { ClsService } from "nestjs-cls";
import { TenantStats } from "@modules/tenant/types/tenant.types";



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

  findAllTenants(): Promise<Tenant[]> {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
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

  setTenantActive(id: string, isActive: boolean): Promise<Tenant> {
    return this.prisma.tenant.update({
      where: { id },
      data: { isActive },
    });
  }

  async getTenantStats(id: string): Promise<TenantStats> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [row] = await this.prisma.$queryRaw<
      [
        {
          wallet_count: bigint;
          user_count: bigint;
          transfer_count_30d: bigint;
          unresolved_failed_events: bigint;
        },
      ]
    >`
    SELECT
      (SELECT COUNT(*) FROM "Wallet"   WHERE "tenantId" = ${id})                                      AS wallet_count,
      (SELECT COUNT(*) FROM "User"     WHERE "tenantId" = ${id})                                      AS user_count,
      (SELECT COUNT(*) FROM "Transfer" WHERE "tenantId" = ${id} AND "createdAt" >= ${thirtyDaysAgo})  AS transfer_count_30d,
      (SELECT COUNT(*) FROM "DlqEvent" WHERE "tenantId" = ${id} AND "replayedAt" IS NULL)             AS unresolved_failed_events
  `;

    return {
      walletCount: Number(row.wallet_count),
      userCount: Number(row.user_count),
      transferCount30d: Number(row.transfer_count_30d),
      unresolvedFailedEvents: Number(row.unresolved_failed_events),
    };
  }
}