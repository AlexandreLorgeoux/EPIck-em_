import type { AuthUser } from "./session-token";
import { accessRules, routes, type AccessRule } from "@/lib/routes";
import { loginPath } from "./return-path";

// The most specific rule for a path: "/admin/teams" matches "/admin" but
// "/administration" does not
export function ruleFor(
  pathname: string,
  rules: readonly AccessRule[] = accessRules,
): AccessRule | null {
  const matching = rules.filter(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  return matching.sort((a, b) => b.prefix.length - a.prefix.length)[0] ?? null;
}

export type AccessDecision =
  | { kind: "allow" }
  // Not signed in: go to the login page, then come back here
  | { kind: "login"; location: string }
  // Signed in, but this role may not open the page
  | { kind: "forbidden"; location: string };

// What to do with a request, given who sent it (null: nobody signed in)
export function decideAccess(
  pathname: string,
  search: string,
  user: AuthUser | null,
  rules: readonly AccessRule[] = accessRules,
): AccessDecision {
  const rule = ruleFor(pathname, rules);
  if (!rule) return { kind: "allow" };
  if (!user) return { kind: "login", location: loginPath(pathname + search) };
  if (rule.allow === "signed-in" || rule.allow.includes(user.role)) {
    return { kind: "allow" };
  }
  return { kind: "forbidden", location: routes.forbidden };
}
