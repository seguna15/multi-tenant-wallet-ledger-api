import { TenantStore } from "@common/cls/tenant-store.interface";
import { PrismaService } from "@common/database/prisma.service";
import { BaseRepository } from "@common/repositories/base.repository";
import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, Tenant } from "@prisma/client";
import { ClsService } from "nestjs-cls";



@Injectable()
export class TenantRepository extends BaseRepository {
  constructor(
    prisma: PrismaService,
    cls: ClsService<TenantStore>
  ){
    super(prisma, cls);
  }

  
  createSingleTenant(data: Prisma.TenantCreateInput): Promise<Tenant> {
    return this.prisma.tenant.create({data})
  }

  
  findSingleTenant(id: string): Promise<Tenant | null> {
    return this.prisma.tenant.findFirst({ 
        where: this.withTenant({ id })
    });
  }

  
  findByApiKeyHash(hashedKey: string): Promise<Tenant | null> {
    return this.prisma.tenant.findUnique({
        where: {apiKeyHash: hashedKey}
    })
  }

  async updateSingleTenant(
    id: string,
    data: Prisma.TenantUpdateInput
  ): Promise<Tenant> {
    return this.prisma.tenant.update({
        where: { id, ...this.tenantFilter },
        data,
    })
  }

  
  softDeleteSingleTenant(id: string): Promise<Tenant> {
    return this.prisma.tenant.update({
        where: { id, ...this.tenantFilter },
        data: {isActive: false},
    })
  }

  updateApiKeyLastUsedAt(id: string): Promise<Tenant> {
    return this.prisma.tenant.update({
        where: { id, ...this.tenantFilter },
        data: { apiKeyLastUsedAt: new Date() },
    })
  }

}