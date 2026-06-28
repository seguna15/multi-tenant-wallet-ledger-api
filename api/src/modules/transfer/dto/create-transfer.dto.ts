import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateTransferDto {
  @ApiProperty({ example: 'uuid-wallet-a', description: 'Source wallet ID' })
  @IsUUID()
  walletFromId!: string;

  @ApiProperty({
    example: 'uuid-wallet-b',
    description: 'Destination wallet ID',
  })
  @IsUUID()
  walletToId!: string;

  @ApiProperty({
    example: 100.5,
    description: 'Amount in display units (e.g. 100.50 USD)',
  })
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiPropertyOptional({
    example: '1.2345',
    description:
      'FX rate source→destination. Omit for same-currency (defaults to "1").',
  })
  @IsOptional()
  @IsString()
  fxRate?: string;

  @ApiPropertyOptional({ example: 'idem-key-abc123' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
