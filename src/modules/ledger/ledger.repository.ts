import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { BaseRepository } from '@common/repositories/base.repository';
import { PrismaService } from '@common/database/prisma.service';
import { TenantStore } from '@common/cls/tenant-store.interface';
import { JournalEntryType } from '@prisma-client';
import { WriteJournalEntriesInput } from '@modules/ledger/types';


@Injectable()
export class LedgerRepository extends BaseRepository {
  constructor(prisma: PrismaService, cls: ClsService<TenantStore>) {
    super(prisma, cls);
  }

  // Atomically writes a DEBIT on debitWalletId and a CREDIT on creditWalletId.
  // Always called together — the two entries are inseparable by design.
  async writeEntryPair(input: WriteJournalEntriesInput) {
    const {
      transferId,
      debitWalletId,
      creditWalletId,
      debitAmount,
      debitCurrency,
      creditAmount,
      creditCurrency,
    } = input;
    const tenantId = this.tenantId;

      return this.prisma.$transaction([
        this.prisma.journalEntry.create({
          data: {
            tenantId,
            walletId: debitWalletId,
            transferId,
            type: JournalEntryType.DEBIT,
            amount: debitAmount,
            currency: debitCurrency,
          },
        }),
        this.prisma.journalEntry.create({
          data: {
            tenantId,
            walletId: creditWalletId,
            transferId,
            type: JournalEntryType.CREDIT,
            amount: creditAmount,
            currency: creditCurrency,
          },
        }),
      ]);
  }

  async findByWallet(
    walletId: string,
    type: JournalEntryType | undefined,
    cursor: string | undefined,
    take: number,
  ) {
    const rows = await this.prisma.journalEntry.findMany({
      where: this.withTenant({ walletId, ...(type && { type }) }),
      take: take + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { createdAt: 'desc' },
      include: {
        transfer: { select: { id: true, status: true, toCurrency: true } },
      },
    });
    return this.paginateResult(rows, take);
  }

  async computeBalance(walletId: string): Promise<bigint> {
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

    const totalCredits = (credits._sum.amount ?? 0n) as bigint;
    const totalDebits = (debits._sum.amount ?? 0n) as bigint;

    return totalCredits - totalDebits;
  }

  private paginateResult<T extends { id: string }>(rows: T[], take: number) {
    const hasNextPage = rows.length > take;
    const items = hasNextPage ? rows.slice(0, -1) : rows;
    return {
      items,
      nextCursor: hasNextPage ? items[items.length - 1].id : null,
    };
  }
}
