import { Global, Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';

@Global()
@Module({
  imports: [
    // Login and registration attempts per IP and per minute
    ThrottlerModule.forRootAsync({
      useFactory: () => [
        { ttl: 60_000, limit: Number(process.env.AUTH_RATE_LIMIT ?? 10) },
      ],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, TokenService],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
