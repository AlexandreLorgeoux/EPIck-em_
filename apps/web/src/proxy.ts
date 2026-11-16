import { NextResponse, type NextRequest } from "next/server";
import type { Role } from "@/lib/api/models";
import { decideAccess, ruleFor } from "@/lib/auth/access";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  readAccessToken,
  type AuthUser,
} from "@/lib/auth/session-token";

// Runs before protected pages render (Next.js 16 "proxy", formerly
// middleware): sends signed-out visitors to the login page and shows the
// "access denied" page to roles the page is not for. Rules live in src/lib/routes.ts.

const apiUrl = () => process.env.API_URL ?? "http://localhost:4000";

// The access token lasts 15 minutes: when it has expired but the refresh
// cookie is still valid, renew the session here rather than asking the user
// to sign in again. Rare (once per expiry), so it costs one API call then.
// Two requests renewing at the same instant would race, since the refresh
// token changes on use; a navigation after a pause is a single request, so
// this only happens with several tabs reopened at once.
async function renewSession(
  request: NextRequest,
): Promise<{ user: AuthUser; setCookies: string[] } | null> {
  if (!request.cookies.has(REFRESH_COOKIE)) return null;
  try {
    const res = await fetch(`${apiUrl()}/auth/refresh`, {
      method: "POST",
      headers: { cookie: request.headers.get("cookie") ?? "" },
    });
    if (!res.ok) return null;
    const user = (await res.json()) as { id: string; role: Role };
    return {
      user: { id: user.id, role: user.role },
      setCookies: res.headers.getSetCookie(),
    };
  } catch {
    return null;
  }
}

// The request's Cookie header with the renewed cookies in place of the old
// ones, so the page rendered for this very request already uses them
function withCookies(header: string | null, setCookies: string[]): string {
  const cookies = new Map<string, string>();
  for (const pair of (header ?? "").split(";")) {
    const [name, ...value] = pair.trim().split("=");
    if (name) cookies.set(name, value.join("="));
  }
  for (const setCookie of setCookies) {
    const [name, ...value] = setCookie.split(";")[0].split("=");
    cookies.set(name.trim(), value.join("="));
  }
  return [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  // Public pages: nothing to check, no cost
  if (!ruleFor(pathname)) return NextResponse.next();

  let user = await readAccessToken(request.cookies.get(ACCESS_COOKIE)?.value);
  let renewedCookies: string[] = [];
  if (!user) {
    const renewed = await renewSession(request);
    if (renewed) {
      user = renewed.user;
      renewedCookies = renewed.setCookies;
    }
  }

  const decision = decideAccess(pathname, search, user);
  let response: NextResponse;
  if (decision.kind === "login") {
    response = NextResponse.redirect(new URL(decision.location, request.url));
  } else if (decision.kind === "forbidden") {
    // Same URL, with the forbidden page as content. Next.js serves a
    // rewritten page with its own status (200): a real 403 needs the
    // experimental forbidden(), which renders an empty HTML page here.
    response = NextResponse.rewrite(new URL(decision.location, request.url));
  } else if (renewedCookies.length) {
    const headers = new Headers(request.headers);
    headers.set(
      "cookie",
      withCookies(request.headers.get("cookie"), renewedCookies),
    );
    response = NextResponse.next({ request: { headers } });
  } else {
    response = NextResponse.next();
  }
  for (const setCookie of renewedCookies) {
    response.headers.append("set-cookie", setCookie);
  }
  return response;
}

export const config = {
  // Never run on the API proxy, Next.js assets or files such as favicon.ico
  // and images: only on pages
  matcher: ["/((?!api/|_next/static|_next/image|.*\\.[\\w]+$).*)"],
};
