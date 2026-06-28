import { PickType } from '@nestjs/swagger';
import { ListTransfersQueryDto } from '@modules/transfer/dto/list-transfers-query.dto';

export class ExportTransfersQueryDto extends PickType(ListTransfersQueryDto, [
  'status',
  'from',
  'to',
] as const) {}
