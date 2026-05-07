import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { BaseRepository } from '@common/repositories/base.repository';
import { PrismaService } from '@common/database/prisma.service';
import { TenantStore } from '@common/cls/tenant-store.interface';
import {
  OutboxEventType,
  OutboxStatus,
  TransferStatus,
} from '@prisma-client';
import { CreateTransferInput } from '@modules/transfer/types';



@Injectable()
export class TransferRepository extends BaseRepository {
  constructor(prisma: PrismaService, cls: ClsService<TenantStore>) {
    super(prisma, cls);
  }

  async createWithOutbox(input: CreateTransferInput) {
    const tenantId = this.tenantId;

    return this.prisma.$transaction(async (tx) => {
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
          },
        },
      });

      return transfer;
    });
  }

  async findById(id: string) {
    return this.prisma.transfer.findFirst({
      where: this.withTenant({ id }),
      include: {
        walletFrom: { select: { id: true, currency: true, userId: true } },
        walletTo: { select: { id: true, currency: true, userId: true } },
      },
    });
  }

  async updateStatus(id: string, status: TransferStatus) {
    return this.prisma.transfer.update({
      where: { id, tenantId: this.tenantId },
      data: { status },
    });
  }
}
