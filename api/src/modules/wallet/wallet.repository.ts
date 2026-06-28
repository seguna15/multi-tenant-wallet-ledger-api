import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { BaseRepository } from '@common/repositories/base.repository';
import { PrismaService } from '@common/database/prisma.service';
import { TenantStore } from '@common/cls/tenant-store.interface';
import { Currency, JournalEntryType } from '@prisma-client';

interface WalletFilter {
  currency?: Currency;
  isActive?: boolean;
  accountNumber?: string;
  from?: string;
  to?: string;
}

@Injectable()
export class WalletRepository extends BaseRepository {
  constructor(prisma: PrismaService, cls: ClsService<TenantStore>) {
    super(prisma, cls);
  }

  async create(currency: Currency, accountNumber: string) {
    return this.prisma.wallet.create({
      data: {
        currency,
        accountNumber,
        userId: this.currentUserId,
        tenantId: this.tenantId,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.wallet.findFirst({
      where: this.withTenant({ id }),
    });
  }

  async findByIdForUser(id: string) {
    return this.prisma.wallet.findFirst({
      where: this.withTenant({ id, userId: this.currentUserId }),
    });
  }

  async findByAccountNumber(accountNumber: string) {
    return this.prisma.wallet.findFirst({
      where: this.withTenant({ accountNumber, isActive: true }),
      select: { id: true, accountNumber: true, currency: true },
    });
  }

  async findAllForTenant(
    filter: WalletFilter,
    cursor: string | undefined,
    take: number,
  ) {
    const { currency, isActive, accountNumber, from, to } = filter;

    const rows = await this.prisma.wallet.findMany({
      where: this.withTenant({
        ...(currency && { currency }),
        ...(isActive !== undefined && { isActive }),
        ...(accountNumber && { accountNumber }),
        ...((from || to) && {
          createdAt: {
            ...(from && { gte: new Date(`${from}T00:00:00.000Z`) }),
            ...(to && { lte: new Date(`${to}T23:59:59.999Z`) }),
          },
        }),
      }),
      take: take + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { createdAt: 'desc' },
    });
    return this.paginateResult(rows, take);
  }

  private paginateResult<T extends { id: string }>(rows: T[], take: number) {
    const hasNextPage = rows.length > take;
    const items = hasNextPage ? rows.slice(0, -1) : rows;
    return {
      items,
      nextCursor: hasNextPage ? items[items.length - 1].id : null,
    };
  }

  async findAllForUser(
    filter: WalletFilter,
    cursor: string | undefined,
    take: number,
  ) {
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
}
