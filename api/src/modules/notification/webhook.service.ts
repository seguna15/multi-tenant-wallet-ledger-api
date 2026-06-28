import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '@common/database/prisma.service';
import { decrypt } from '@shared/utils/encryption';
import { TransferStatus, Currency } from '@prisma-client';

export interface WebhookPayload {
  transferId: string;
  status: TransferStatus;
  amount: string; // smallest unit (e.g. cents)
  currency: Currency;
  timestamp: string; // ISO-8601
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  async deliver(
    tenantId: string,
    payload: WebhookPayload,
    correlationId: string,
  ): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { webhookUrl: true, webhookSecret: true },
    });

    if (!tenant?.webhookUrl || !tenant.webhookSecret) {
      this.logger.log({
        msg: 'no webhook configured — skipping delivery',
        tenantId,
        correlationId,
      });
      return;
    }

    const body = JSON.stringify(payload);
    const signature = this.sign(body, decrypt(tenant.webhookSecret));
    const startedAt = Date.now();

    try {
      const response = await fetch(tenant.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Correlation-Id': correlationId,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });

      this.logger.log({
        msg: 'webhook delivery attempt',
        tenantId,
        transferId: payload.transferId,
        status: payload.status,
        httpStatus: response.status,
        durationMs: Date.now() - startedAt,
        correlationId,
        success: response.ok,
      });

      if (!response.ok) {
        throw new Error(`Webhook responded with HTTP ${response.status}`);
      }
    } catch (error) {
      this.logger.error({
        msg: 'webhook delivery failed',
        tenantId,
        transferId: payload.transferId,
        durationMs: Date.now() - startedAt,
        correlationId,
        error,
      });
      throw error; // caller (consumer) handles retry/DLQ routing
    }
  }

  private sign(body: string, secret: string): string {
    return (
      'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex')
    );
  }
}
