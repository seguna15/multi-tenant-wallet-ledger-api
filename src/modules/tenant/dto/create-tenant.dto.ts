import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from "class-validator";


export class CreateTenantDto {
    @ApiProperty({
        description: "The name of the tenant",
        example: "Acme Corporation",
    })
    @IsString()
    @MinLength(2)
    @MaxLength(100)
    name!: string;

    @ApiPropertyOptional({
        description: "The webhook URL for the tenant",
        example: "https://example.com/webhook",
    })
    @IsOptional()
    @IsUrl()
    webhookUrl?: string;

    @ApiPropertyOptional({
        description: "Whether the tenant is active. Defaults to true.",
        example: true,
    })
    @IsOptional()  
    isActive?: boolean; // Optional, defaults to true in the service layer
}