import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';


@Module({
  imports: [
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
  
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
