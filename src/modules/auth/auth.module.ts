import { TenantModule } from "@modules/tenant/tenant.module";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthService } from "@modules/auth/auth.service";
import { AuthRepository } from '@modules/auth/auth.repository';
import { ApiKeyStrategy } from '@modules/auth/strategies/api-key.strategy';
import { JwtStrategy } from '@modules/auth/strategies/jwt.strategy';
import { AuthController } from '@modules/auth/auth.controller';


@Module({
    imports: [
        PassportModule,
        TenantModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                secret: config.getOrThrow<string>('ACCESS_TOKEN_SECRET'),
                signOptions: { expiresIn: config.get('ACCESS_TOKEN_EXPIRES_IN', '15m') },
            }),
        }),
    ],
    controllers: [AuthController],
    providers:[AuthService, AuthRepository, ApiKeyStrategy, JwtStrategy],
    exports: [JwtModule]
})
export class AuthModule {}