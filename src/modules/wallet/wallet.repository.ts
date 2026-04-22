import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { BaseRepository } from '@common/repositories/base.repository';
import { PrismaService } from '@common/database/prisma.service';
import { TenantStore } from '@common/cls/tenant-store.interface';
import { Currency, JournalEntryType } from '@prisma-client';

interface WalletFilter {
  currency?: Currency;
  isActive?: boolean;
}

@Injectable()
export class WalletRepository extends BaseRepository {
  constructor(prisma: PrismaService, cls: ClsService<TenantStore>) {
    super(prisma, cls);
  }

  async create(currency: Currency) {
    return this.prisma.wallet.create({
      data: { currency, userId: this.currentUserId, tenantId: this.tenantId },
    });
  }

  async findById(id: string) {
    return this.prisma.wallet.findFirst({
      where: this.withTenant({ id }),
    });
  }

  async findAllForTenant(filter: WalletFilter, cursor: string | undefined, take: number) {
    const rows = await this.prisma.wallet.findMany({
      where: this.withTenant({ ...filter }),
      take: take + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { createdAt: 'desc' },
    });
    return this.paginateResult(rows, take);
  }

  // Admin — no tenant scoping, queries across all tenants
  async findAll(filter: WalletFilter, cursor: string | undefined, take: number) {
    const rows = await this.prisma.wallet.findMany({
      where: Object.keys(filter).length ? filter : undefined,
      take: take + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { createdAt: 'desc' },
      include: { tenant: { select: { id: true, name: true } } },
    });
    return this.paginateResult(rows, take);
  }

  private paginateResult<T extends { id: string }>(rows: T[], take: number) {
    const hasNextPage = rows.length > take;
    const items = hasNextPage ? rows.slice(0, -1) : rows;
    return { items, nextCursor: hasNextPage ? items[items.length - 1].id : null };
  }

  async findAllForUser(filter: WalletFilter, cursor: string | undefined, take: number) {
    const rows = await this.prisma.wallet.findMany({
      where: this.withTenant({ userId: this.currentUserId, ...filter }),
      take: take + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { createdAt: 'desc' },
    });
    return this.paginateResult(rows, take);
  }

  async findByUserAndCurrency(currency: Currency) {
    return this.prisma.wallet.findFirst({
      where: this.withTenant({
        userId: this.currentUserId,
        currency,
        isActive: true,
      }),
    });
  }

  async computeBalance(walletId: string): Promise<number> {
    const [credits, debits] = await Promise.all([
      this.prisma.journalEntry.aggregate({
        where: this.withTenant({ walletId, type: JournalEntryType.CREDIT }),
        _sum: { amount: true },
      }),
      this.prisma.journalEntry.aggregate({
        where: this.withTenant({ walletId, type: JournalEntryType.DEBIT }),
        _sum: { amount: true },
      }),
    ]);

    return Number(credits._sum.amount ?? 0) - Number(debits._sum.amount ?? 0);
  }
}
