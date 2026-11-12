import { createApiClient } from "./create-client";
import { sessionHandlers, singleFlight } from "./session";

// In the browser, calls go to /api, which Next.js forwards to the API
// (next.config.ts), so the session cookies stay on the site's own origin
const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api";

async function refreshThroughApi() {
  try {
    const res = await fetch(`${baseUrl}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}

// One silent refresh attempt, shared by all requests that got a 401, then
// sign out if it failed
const renewSession = singleFlight(async () => {
  const handlers = sessionHandlers();
  const renewed = await (handlers?.refresh ?? refreshThroughApi)();
  if (!renewed) handlers?.onExpired();
  return renewed;
});

/**
 * API client for client components.
 *
 *   const team = await api.get<Team>(`/teams/${id}`);
 *   await api.post<Team>("/teams", { name: "Alpha" });
 *
 * Server components use getServerApi() from './server' instead.
 */
export const api = createApiClient({ baseUrl, onUnauthorized: renewSession });
