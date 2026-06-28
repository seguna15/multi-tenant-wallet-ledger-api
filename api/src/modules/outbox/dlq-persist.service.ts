import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { DlqReason } from '@prisma-client';

export interface DlqPersistParams {
  queue: string;
  exchange: string;
  routingKey: string;
  payload: Buffer;
  headers: Record<string, unknown>;
  correlationId: string;
  tenantId?: string;
  reason: DlqReason;
}

@Injectable()
export class DlqPersistService {
  private readonly logger = new Logger(DlqPersistService.name);

  constructor(private readonly prisma: PrismaService) {}

  async persist(params: DlqPersistParams): Promise<void> {
    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(params.payload.toString()) as unknown;
    } catch {
      // Unparseable payload — store raw base64 so nothing is silently lost
      parsedPayload = { _raw: params.payload.toString('base64') };
    }

    try {
      await this.prisma.dlqEvent.create({
        data: {
          queue: params.queue,
          exchange: params.exchange,
          routingKey: params.routingKey,
          payload: parsedPayload as object,
          headers: params.headers as object,
          correlationId: params.correlationId,
          tenantId: params.tenantId,
          reason: params.reason,
        },
      });
    } catch (err) {
      // Persist failure must never break the primary DLQ publish path
      this.logger.error({
        msg: 'failed to persist DLQ event',
        queue: params.queue,
        correlationId: params.correlationId,
        err,
      });
    }
  }
}
