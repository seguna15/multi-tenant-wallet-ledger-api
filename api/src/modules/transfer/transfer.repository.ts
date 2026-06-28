import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { BaseRepository } from '@common/repositories/base.repository';
import { PrismaService } from '@common/database/prisma.service';
import { TenantStore } from '@common/cls/tenant-store.interface';
import {
  OutboxEventType,
  OutboxStatus,
  TransferStatus,
  Currency,
  JournalEntryType,
  Prisma,
} from '@prisma-client';
import { CreateTransferInput, TransferExportRow, TransferTenantExportRow } from '@modules/transfer/types';
import { LedgerRepository } from '@modules/ledger/ledger.repository';
import { fromSmallestUnit, CURRENCY_DECIMALS } from '@common/utils/money.utils';


@Injectable()
export class TransferRepository extends BaseRepository {
  constructor(
    prisma: PrismaService,
    cls: ClsService<TenantStore>,
    private readonly ledgerRepository: LedgerRepository,
  ) {
    super(prisma, cls);
  }

  async createWithOutbox(input: CreateTransferInput) {
    const tenantId = this.tenantId;

    return this.prisma.$transaction(async (tx) => {
      // Lock wallet row — concurrent transactions block here until this one commits
      await tx.$queryRaw`
      SELECT id FROM "Wallet"
      WHERE id = ${input.walletFromId}
      FOR UPDATE
    `;

      // Posted balance — sees a serialized snapshot of settled journal entries
      const balance = await this.ledgerRepository.computeBalance(
        input.walletFromId,
        tx,
      );

      // Other transfers from this wallet that have been approved but whose
      // debit hasn't posted yet (the outbox consumer settles them async).
      // These funds are already promised and must not be lent out twice.
      const reserved = await this.computePendingOutgoing(
        input.walletFromId,
        tx,
      );

      const available = balance - reserved;

      if (available < input.fromAmount) {
        throw new UnprocessableEntityException(
          'Insufficient funds in the source wallet',
        );
      }

      const transfer = await tx.transfer.create({
        data: {
          tenantId,
          walletFromId: input.walletFromId,
          walletToId: input.walletToId,
          fromAmount: input.fromAmount,
          toAmount: input.toAmount,
          fromCurrency: input.fromCurrency,
          toCurrency: input.toCurrency,
          fxRate: input.fxRate,
          status: TransferStatus.INITIATED,
          ...(input.idempotencyKey && { idempotencyKey: input.idempotencyKey }),
        },
      });

      await tx.outboxEvent.create({
        data: {
          tenantId,
          transferId: transfer.id,
          eventType: OutboxEventType.TRANSFER_INITIATED,
          status: OutboxStatus.PENDING,
          payload: {
            transferId: transfer.id,
            tenantId,
            walletFromId: input.walletFromId,
            walletToId: input.walletToId,
            fromAmount: input.fromAmount.toString(),
            toAmount: input.toAmount.toString(),
            fromCurrency: input.fromCurrency,
            toCurrency: input.toCurrency,
            fxRate: input.fxRate,
            status: TransferStatus.INITIATED,
            correlationId: this.correlationId,
          },
        },
      });

      return transfer;
    });
  }

  // Sum of fromAmount across this wallet's transfers that haven't settled
  // yet (INITIATED or PROCESSING — TransferInitiatedConsumer hasn't posted
  // their journal entries). Excluded from the available balance so a
  // second concurrent transfer can't spend the same funds twice.
  private async computePendingOutgoing(
    walletFromId: string,
    tx: Prisma.TransactionClient,
  ): Promise<bigint> {
    const result = await tx.transfer.aggregate({
      where: this.withTenant({
        walletFromId,
        status: { in: [TransferStatus.INITIATED, TransferStatus.PROCESSING] },
      }),
      _sum: { fromAmount: true },
    });

    return (result._sum.fromAmount ?? 0n) as bigint;
  }

  async findById(id: string) {
    return this.prisma.transfer.findFirst({
      where: this.withTenant({ id }),
      include: {
        walletFrom: {
          select: { id: true, currency: true, accountNumber: true },
        },
        walletTo: { select: { id: true, currency: true, accountNumber: true } },
      },
    });
  }

  // TENANT_ADMIN — every transfer in the tenant, optionally narrowed to one account
  async findAllForTenant(
    filters: {
      status?: TransferStatus;
      from?: string;
      to?: string;
      accountNumber?: string;
    },
    cursor: string | undefined,
    take: number,
  ) {
    const { status, from, to, accountNumber } = filters;

    const rows = await this.prisma.transfer.findMany({
      where: this.withTenant({
        ...(status && { status }),
        ...((from || to) && {
          createdAt: {
            ...(from && { gte: new Date(`${from}T00:00:00.000Z`) }),
            ...(to && { lte: new Date(`${to}T23:59:59.999Z`) }),
          },
        }),
        ...(accountNumber && {
          OR: [
            { walletFrom: { accountNumber } },
            { walletTo: { accountNumber } },
          ],
        }),
      }),
      take: take + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { createdAt: 'desc' },
      include: {
        walletFrom: {
          select: { id: true, currency: true, accountNumber: true },
        },
        walletTo: { select: { id: true, currency: true, accountNumber: true } },
      },
    });

    return this.paginateResult(rows, take);
  }

  // CUSTOMER — only transfers touching a wallet the current user owns
  async findAllForUser(
    filters: { status?: TransferStatus; from?: string; to?: string },
    cursor: string | undefined,
    take: number,
  ) {
    const { status, from, to } = filters;
    const userId = this.currentUserId;

    const rows = await this.prisma.transfer.findMany({
      where: this.withTenant({
        OR: [{ walletFrom: { userId } }, { walletTo: { userId } }],
        ...(status && { status }),
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
      include: {
        walletFrom: {
          select: { id: true, currency: true, accountNumber: true },
        },
        walletTo: { select: { id: true, currency: true, accountNumber: true } },
      },
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

  // CUSTOMER — shaped rows for the streaming CSV export, scoped to wallets the user owns
  async findPageForExport(
    filters: { status?: TransferStatus; from?: string; to?: string },
    cursor: string | undefined,
    take: number,
  ): Promise<{ items: TransferExportRow[]; nextCursor: string | null }> {
    const { status, from, to } = filters;
    const userId = this.currentUserId;

    const rows = await this.prisma.transfer.findMany({
      where: this.withTenant({
        OR: [{ walletFrom: { userId } }, { walletTo: { userId } }],
        ...(status && { status }),
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
      select: {
        id: true,
        createdAt: true,
        status: true,
        fromAmount: true,
        toAmount: true,
        fromCurrency: true,
        toCurrency: true,
        walletFrom: { select: { userId: true, accountNumber: true } },
        walletTo: { select: { userId: true, accountNumber: true } },
      },
    });

    const hasNextPage = rows.length > take;
    const page = hasNextPage ? rows.slice(0, -1) : rows;

    const items = page.map((t): TransferExportRow => {
      const isDebit = t.walletFrom.userId === userId;
      const amount = isDebit ? t.fromAmount : t.toAmount;
      const currency = isDebit ? t.fromCurrency : t.toCurrency;

      return {
        date: t.createdAt.toISOString(),
        direction: isDebit ? JournalEntryType.DEBIT : JournalEntryType.CREDIT,
        counterpartyAccount: isDebit
          ? t.walletTo.accountNumber
          : t.walletFrom.accountNumber,
        amount: fromSmallestUnit(amount, currency).toFixed(
          CURRENCY_DECIMALS[currency],
        ),
        currency,
        status: t.status,
      };
    });

    return {
      items,
      nextCursor: hasNextPage ? page[page.length - 1].id : null,
    };
  }

  // TENANT_ADMIN — shaped rows for the streaming CSV export, tenant-wide
  async findPageForTenantExport(
    filters: {
      status?: TransferStatus;
      from?: string;
      to?: string;
      accountNumber?: string;
    },
    cursor: string | undefined,
    take: number,
  ): Promise<{ items: TransferTenantExportRow[]; nextCursor: string | null }> {
    const { status, from, to, accountNumber } = filters;

    const rows = await this.prisma.transfer.findMany({
      where: this.withTenant({
        ...(status && { status }),
        ...((from || to) && {
          createdAt: {
            ...(from && { gte: new Date(`${from}T00:00:00.000Z`) }),
            ...(to && { lte: new Date(`${to}T23:59:59.999Z`) }),
          },
        }),
        ...(accountNumber && {
          OR: [
            { walletFrom: { accountNumber } },
            { walletTo: { accountNumber } },
          ],
        }),
      }),
      take: take + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        status: true,
        fromAmount: true,
        fromCurrency: true,
        walletFrom: { select: { accountNumber: true } },
        walletTo: { select: { accountNumber: true } },
      },
    });

    const hasNextPage = rows.length > take;
    const page = hasNextPage ? rows.slice(0, -1) : rows;

    const items = page.map((t) => ({
      date: t.createdAt.toISOString(),
      fromAccount: t.walletFrom.accountNumber,
      toAccount: t.walletTo.accountNumber,
      amount: fromSmallestUnit(t.fromAmount, t.fromCurrency).toFixed(
        CURRENCY_DECIMALS[t.fromCurrency],
      ),
      currency: t.fromCurrency,
      status: t.status,
      reference: t.id,
    }));

    return {
      items,
      nextCursor: hasNextPage ? page[page.length - 1].id : null,
    };
  }

  // Used by the customer activity stream — checks ownership without relying on CLS,
  // since the check runs inside an event-emitter callback, not the request context
  async existsForUser(
    transferId: string,
    tenantId: string,
    userId: string,
  ): Promise<boolean> {
    const count = await this.prisma.transfer.count({
      where: {
        id: transferId,
        tenantId,
        OR: [{ walletFrom: { userId } }, { walletTo: { userId } }],
      },
    });
    return count > 0;
  }

  async updateStatus(id: string, status: TransferStatus) {
    return this.prisma.transfer.update({
      where: { id, tenantId: this.tenantId },
      data: { status },
    });
  }
}
