import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResolveWalletQueryDto {
  @ApiProperty({
    example: 'TN-a1b2c3-X9Y8Z7W6',
    description: 'Account number to resolve to a wallet ID (tenant-scoped)',
  })
  @IsString()
  @MinLength(1)
  accountNumber!: string;
}
