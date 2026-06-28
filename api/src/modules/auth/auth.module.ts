import { TenantModule } from "@modules/tenant/tenant.module";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthService } from "@modules/auth/auth.service";
import { AuthRepository } from '@modules/auth/auth.repository';
import {
  ApiKeyStrategy,
  JwtStrategy,
  AdminKeyStrategy,
  AdminJwtStrategy,
} from '@modules/auth/strategies';
import { AuthController } from '@modules/auth/auth.controller';
import { AdminAuthController } from '@modules/auth/admin.auth.controller';


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
    controllers: [AuthController, AdminAuthController],
    providers:[AuthService, AuthRepository, ApiKeyStrategy, AdminKeyStrategy, JwtStrategy, AdminJwtStrategy],
    exports: [JwtModule]
})
export class AuthModule {}