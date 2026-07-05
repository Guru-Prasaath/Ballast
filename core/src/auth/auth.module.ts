import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { MeController } from './me.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Authentication: signup/login/refresh and the guarded /me route. Secrets are
 * passed per-sign in TokenService, so JwtModule needs no global registration.
 */
@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController, MeController],
  providers: [AuthService, TokenService, JwtAuthGuard],
  exports: [TokenService, JwtAuthGuard],
})
export class AuthModule {}
