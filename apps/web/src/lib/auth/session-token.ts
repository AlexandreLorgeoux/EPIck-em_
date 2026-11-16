import { jwtVerify } from "jose";
import type { Role } from "@/lib/api/models";

// Cookies set by the API (apps/api/src/auth/auth.config.ts)
export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

export interface AuthUser {
  id: string;
  role: Role;
}

const ROLES: readonly string[] = ["admin", "player", "user"];

// Reads the access token the API signed, without calling the API. Needs the
// same AUTH_SECRET as the API. Null for anything that is not a valid,
// unexpired token: a missing secret refuses every token rather than
// accepting forged ones.
export async function readAccessToken(
  token: string | undefined,
  secret = process.env.AUTH_SECRET,
): Promise<AuthUser | null> {
  if (!token || !secret) return null;
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
      {
        algorithms: ["HS256"],
      },
    );
    if (!payload.sub || !ROLES.includes(payload.role as string)) return null;
    return { id: payload.sub, role: payload.role as Role };
  } catch {
    return null;
  }
}
