import { describe, expect, it } from '@jest/globals';
import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from './auth-user.js';
import { Public, Roles } from './roles.decorator.js';
import { RolesGuard } from './roles.guard.js';

// Routes declared like real controllers, so the guard reads real metadata
@Roles('admin')
class AdminController {
  manage() {}

  @Public()
  health() {}

  @Roles('admin', 'player')
  shared() {}
}

class OpenController {
  signedIn() {}
}

const contextFor = (
  controller: new () => object,
  method: string,
  user?: AuthUser,
) =>
  ({
    getClass: () => controller,
    getHandler: () =>
      (controller.prototype as Record<string, () => void>)[method],
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

const admin: AuthUser = { id: 'u1', role: 'admin' };
const player: AuthUser = { id: 'u2', role: 'player' };
const plainUser: AuthUser = { id: 'u3', role: 'user' };

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it('lets anyone through a @Public() route, even inside an admin controller', () => {
    expect(guard.canActivate(contextFor(AdminController, 'health'))).toBe(true);
  });

  it('rejects an anonymous visitor everywhere else with 401', () => {
    const run = () => guard.canActivate(contextFor(OpenController, 'signedIn'));
    expect(run).toThrow(UnauthorizedException);
    expect(run).toThrow('Sign in to access this resource');
  });

  it('lets any signed-in user through a route without @Roles()', () => {
    for (const user of [admin, player, plainUser]) {
      expect(
        guard.canActivate(contextFor(OpenController, 'signedIn', user)),
      ).toBe(true);
    }
  });

  it('applies a controller-level @Roles() to its routes', () => {
    expect(
      guard.canActivate(contextFor(AdminController, 'manage', admin)),
    ).toBe(true);
  });

  it('rejects a role that is not listed with 403 and names the allowed roles', () => {
    const run = () =>
      guard.canActivate(contextFor(AdminController, 'manage', plainUser));
    expect(run).toThrow(ForbiddenException);
    expect(run).toThrow('This action requires one of these roles: admin');
  });

  it('lets a route-level @Roles() override the controller one', () => {
    expect(
      guard.canActivate(contextFor(AdminController, 'shared', player)),
    ).toBe(true);
    expect(() =>
      guard.canActivate(contextFor(AdminController, 'shared', plainUser)),
    ).toThrow(ForbiddenException);
  });
});
