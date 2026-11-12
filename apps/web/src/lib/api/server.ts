import { cookies } from "next/headers";
import { createApiClient } from "./create-client";

/**
 * API client for server components, route handlers and server actions. It
 * calls the API directly and forwards the visitor's cookies, so requests run
 * as the signed-in user.
 *
 *   const api = await getServerApi();
 *   const teams = await api.get<Team[]>("/teams");
 *
 * No refresh on a 401 here: a server component cannot set cookies. The
 * route middleware (#30) and the browser client renew the session instead.
 */
export async function getServerApi() {
  const store = await cookies();
  const cookie = store
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");
  return createApiClient({
    baseUrl: process.env.API_URL ?? "http://localhost:4000",
    headers: cookie ? { cookie } : {},
  });
}
