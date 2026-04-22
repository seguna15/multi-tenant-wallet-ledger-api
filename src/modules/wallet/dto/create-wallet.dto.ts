import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { Currency } from '@prisma-client';

export class CreateWalletDto {
  @ApiProperty({
    description: 'Wallet currency',
    example: 'USD',
    enum: Currency,
  })
  @IsEnum(Currency)
  currency!: Currency;
}
