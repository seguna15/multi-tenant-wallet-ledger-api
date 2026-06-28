import { NestFactory } from '@nestjs/core';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import cookieParser from 'cookie-parser';
import { corsConfig } from '@lib/config/cors.config';

// add after app.useLogger(...)


async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.enableCors(corsConfig);
  app.useLogger(app.get(Logger));
  app.use(cookieParser());

  // Graceful shutdown: NestJS calls OnModuleDestroy hooks before closing.
  // OutboxWorker, TransferInitiatedConsumer, etc. cancel their consumers there.
  app.enableShutdownHooks();

  
  // BigInt → string in all JSON responses
  app
    .getHttpAdapter()
    .getInstance()
    .set('json replacer', (_key: string, value: unknown) =>
      typeof value === 'bigint' ? value.toString() : value,
    );

  app.setGlobalPrefix('api/v1');

 app.useGlobalPipes(
   new ValidationPipe({
     whitelist: true,
     forbidNonWhitelisted: true,
     transform: true,
     exceptionFactory: (errors) => {
       const messages = errors.flatMap((error) =>
         Object.values(error.constraints ?? {}),
       );
       return new BadRequestException(
         messages.length ? messages : 'Validation failed',
       );
     },
   }),
 );

  const config = new DocumentBuilder()
    .setTitle('Ledger API')
    .setDescription(
      'API documentation for multi-tenant wallet and ledger application',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', in: 'header', name: 'x-api-key' }, 'ApiKey')
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'x-admin-key' },
      'AdminKey',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 8000;
  await app.listen(port);
}
bootstrap();
