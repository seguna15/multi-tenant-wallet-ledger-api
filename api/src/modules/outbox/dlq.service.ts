import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Channel } from 'amqplib';
import { ClsService } from 'nestjs-cls';

import { PrismaService } from '@common/database/prisma.service';
import { TenantStore } from '@common/cls/tenant-store.interface';
import { TransferStatus } from '@prisma-client';
import {
  RABBITMQ_CHANNEL,
  TRANSFER_QUEUE,
  TRANSFER_COMPLETED_QUEUE,
  NOTIFICATION_QUEUE,
  TRANSFER_COMPLETED_DLQ_QUEUE,
} from '@modules/outbox/rabbitmq.constants';
import { DLQ_QUEUE } from '@modules/outbox/dlq.config';
import { NOTIFICATION_DLQ_QUEUE } from '@modules/outbox/notification.dlq.config';
import { ListDlqEventsQueryDto } from '@modules/outbox/dto/list-dlq-events-query.dto';

const DLQ_TO_WORK_QUEUE: Record<string, string> = {
  [DLQ_QUEUE]: TRANSFER_QUEUE,
  [TRANSFER_COMPLETED_DLQ_QUEUE]: TRANSFER_COMPLETED_QUEUE,
  [NOTIFICATION_DLQ_QUEUE]: NOTIFICATION_QUEUE,
};

@Injectable()
export class DlqService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clsService: ClsService<TenantStore>,
    @Inject(RABBITMQ_CHANNEL) private readonly channel: Channel,
  ) {}

  async listEvents(query: ListDlqEventsQueryDto) {
    const { queue, unresolved, cursor, limit = 20 } = query;
    const isGlobalAdmin = this.clsService.get('isGlobalAdmin');

    const rows = await this.prisma.dlqEvent.findMany({
      where: {
        ...(queue ? { queue } : {}),
        ...(unresolved ? { replayedAt: null } : {}),
        ...(isGlobalAdmin ? {} : { tenantId: this.clsService.get('tenantId') }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });

    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, -1) : rows;
    return { items, nextCursor: hasNextPage ? items[items.length - 1].id : null };
  }

  async replayEvent(id: string) {
    const event = await this.prisma.dlqEvent.findUnique({ where: { id } });

    const isGlobalAdmin = this.clsService.get('isGlobalAdmin');
    if (!event || (!isGlobalAdmin && event.tenantId !== this.clsService.get('tenantId'))) {
      throw new NotFoundException(`DlqEvent ${id} not found`);
    }
    if (event.replayedAt) {
      throw new ConflictException(
        `Already replayed at ${event.replayedAt.toISOString()}`,
      );
    }

    const targetQueue = DLQ_TO_WORK_QUEUE[event.queue];
    if (!targetQueue) {
      throw new BadRequestException(
        `No replay target registered for DLQ queue: ${event.queue}`,
      );
    }

    const replayHeaders = {
      ...(event.headers as Record<string, unknown>),
      'x-retry-count': 0,
      'x-replayed-from-dlq': event.id,
      'x-replayed-at': new Date().toISOString(),
    };

    // transfer.initiated.dlq: the original failure marked the transfer
    // FAILED and released its reservation (see
    // TransferInitiatedConsumer.markTransferFailed). Re-arm the reservation
    // before the message goes back on the queue so the wallet's available
    // balance reflects this transfer again while it's retried.
    if (event.queue === DLQ_QUEUE && event.tenantId) {
      const { transferId } = event.payload as { transferId?: string };
      if (transferId) {
        await this.prisma.transfer.update({
          where: { id: transferId, tenantId: event.tenantId },
          data: { status: TransferStatus.INITIATED },
        });
      }
    }

    this.channel.sendToQueue(
      targetQueue,
      Buffer.from(JSON.stringify(event.payload)),
      {
        persistent: true,
        contentType: 'application/json',
        headers: replayHeaders,
      },
    );

    await this.prisma.dlqEvent.update({
      where: { id },
      data: {
        replayedAt: new Date(),
        replayedBy: this.clsService.get('userId') ?? 'unknown',
      },
    });

    return { replayed: true, eventId: id, targetQueue };
  }
}
