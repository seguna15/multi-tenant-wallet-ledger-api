import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsUrl, MaxLength, Min, MinLength } from "class-validator";


export class CreateTenantDto {
    @ApiProperty({
        description: "The name of the tenant",
        example: "Acme Corporation",
    })
    @IsString()
    @MinLength(2)
    @MaxLength(100)
    name: string;

    @ApiPropertyOptional({
        description: "The webhook URL for the tenant",
        example: "https://example.com/webhook",
    })
    @IsOptional()
    @IsUrl()
    webhookUrl?: string;

    @ApiPropertyOptional({
        description: "The webhook secret for the tenant",
        example: "my-webhook-secret",
    })
    @IsOptional()
    @IsString()
    @MinLength(32)
    webhookSecret?: string;
}