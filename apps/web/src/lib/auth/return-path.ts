// Where to go after signing in. Only paths on this site are accepted:
// "/teams?page=2" yes, "//evil.test" or "https://evil.test" no, so a crafted
// login link cannot send the user to another site (open redirect).
export function safeReturnPath(
  value: string | null | undefined,
  fallback = "/",
): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\") ||
    value.startsWith("/login")
  ) {
    return fallback;
  }
  return value;
}

// Login page URL that brings the user back to `returnTo` afterwards
export function loginPath(returnTo?: string | null): string {
  const next = safeReturnPath(returnTo, "");
  return next && next !== "/"
    ? `/login?next=${encodeURIComponent(next)}`
    : "/login";
}
