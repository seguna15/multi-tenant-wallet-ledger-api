import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { DLQ_QUEUE } from '@modules/outbox/dlq.config';
import { TRANSFER_COMPLETED_DLQ_QUEUE } from '@modules/outbox/rabbitmq.constants';
import { NOTIFICATION_DLQ_QUEUE } from '@modules/outbox/notification.dlq.config';

export const DLQ_QUEUES = [
  DLQ_QUEUE,
  TRANSFER_COMPLETED_DLQ_QUEUE,
  NOTIFICATION_DLQ_QUEUE,
] as const;

export class ListDlqEventsQueryDto {
  @ApiPropertyOptional({ enum: DLQ_QUEUES, description: 'Filter by DLQ queue name' })
  @IsOptional()
  @IsIn(DLQ_QUEUES)
  queue?: string;

  @ApiPropertyOptional({ description: 'Only return events that have not been replayed yet' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  unresolved?: boolean;

  @ApiPropertyOptional({ description: 'ID of the last item from the previous page' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
