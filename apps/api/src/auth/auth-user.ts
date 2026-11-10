import type { UserRole } from '../generated/prisma/enums.js';

// Set on `request.user` by the session layer (ticket #9)
export interface AuthUser {
  id: string;
  role: UserRole;
}
