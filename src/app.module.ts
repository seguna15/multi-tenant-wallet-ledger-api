import { PrismaModule } from '@common/database/prisma.module';
import { TenantModule } from '@modules/tenant/tenant.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClsModule } from 'nestjs-cls';
import { LoggerModule } from 'nestjs-pino';



@Module({
  imports: [
    PrismaModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport: process.env.NODE_ENV !== 'development' ? {
          target: 'pino-pretty',
        } : undefined,
        autoLogging: true,
        redact: ['req.headers.authorization', 'req.headers["x-api-key"]'],
      },
    }),
    ClsModule.forRoot({
      global: true, // cls module will be available globally without needing to import it in other modules
      middleware: {
        mount: true, // automatically mount the middleware to capture context for each request
      }
    }),
    TenantModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
