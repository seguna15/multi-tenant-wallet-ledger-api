import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

 const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://localhost:3000', 'http://localhost:3001'];
export const corsConfig: CorsOptions = {
  origin: allowedOrigins,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  allowedHeaders: 'Content-Type, Accept, Authorization, x-api-key, x-admin-key,idempotency-key',
  credentials: true,
};
