import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { OutboxStatus } from '@prisma-client';

const MAX_RETRIES = 3;
const BATCH_SIZE = 50;

@Injectable()
export class OutboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  findPendingBatch() {
    return this.prisma.outboxEvent.findMany({
      where: { status: OutboxStatus.PENDING, retryCount: { lt: MAX_RETRIES } },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
    });
  }

  markPublished(id: string) {
    return this.prisma.outboxEvent.update({
      where: { id },
      data: { status: OutboxStatus.PUBLISHED, publishedAt: new Date() },
    });
  }

  markFailed(id: string) {
    return this.prisma.outboxEvent.update({
      where: { id },
      data: { status: OutboxStatus.FAILED, retryCount: { increment: 1 } },
    });
  }
}
