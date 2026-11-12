import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import type { Express } from 'express';
import { authenticate } from './auth/authenticate.middleware.js';
import { TokenService } from './auth/token.service.js';
import { validationException } from './common/validation-errors.js';

// Shared by main.ts and the e2e tests, so tests run the real configuration
export function configureApp(app: INestApplication) {
  // Behind a proxy (the Next.js rewrite, a load balancer), trust its
  // X-Forwarded-For so rate limits apply per visitor, not per proxy
  // (a number of hops such as "1", or "loopback" / subnets)
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy) {
    (app.getHttpAdapter().getInstance() as Express).set(
      'trust proxy',
      /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy,
    );
  }
  app.use(cookieParser());
  app.use(authenticate(app.get(TokenService)));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationException,
    }),
  );
  app.enableShutdownHooks();
}
