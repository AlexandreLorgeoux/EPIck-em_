import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../generated/prisma/enums.js';

export const ROLES_KEY = 'roles';
export const IS_PUBLIC_KEY = 'isPublic';

// Restricts a controller or route to the given roles
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

// Opens a route to anonymous visitors; every other route requires a user
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
