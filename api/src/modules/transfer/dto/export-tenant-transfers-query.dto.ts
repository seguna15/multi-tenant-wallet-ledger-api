import { PickType } from '@nestjs/swagger';
import { ListTransfersQueryDto } from '@modules/transfer/dto/list-transfers-query.dto';

export class ExportTenantTransfersQueryDto extends PickType(
  ListTransfersQueryDto,
  ['status', 'from', 'to', 'accountNumber'] as const,
) {}
