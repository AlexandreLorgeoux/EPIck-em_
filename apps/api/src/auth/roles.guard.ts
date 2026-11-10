import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '../generated/prisma/enums.js';
import type { AuthUser } from './auth-user.js';
import { IS_PUBLIC_KEY, ROLES_KEY } from './roles.decorator.js';

// Global guard, deny by default: a route is reachable anonymously only when
// marked @Public(), and @Roles() narrows it to the listed roles
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!user) {
      throw new UnauthorizedException('Sign in to access this resource');
    }

    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      targets,
    );
    if (roles?.length && !roles.includes(user.role)) {
      throw new ForbiddenException(
        `This action requires one of these roles: ${roles.join(', ')}`,
      );
    }
    return true;
  }
}
