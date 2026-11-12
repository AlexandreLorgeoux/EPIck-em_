import { jest } from "@jest/globals";

// jsdom has no fetch: tests answer API calls from a table of routes,
// keyed "METHOD /path" as the browser client sends them (under /api)
type Reply = [status: number, body?: unknown];
type Handler = (body: unknown) => Reply;

export function fakeApi(routes: Record<string, Reply | Handler>) {
  const calls: { route: string; body: unknown }[] = [];
  const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
    const route = `${init?.method ?? "GET"} ${url.replace(/^\/api/, "").split("?")[0]}`;
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ route, body });
    const entry = routes[route];
    if (!entry) throw new Error(`No fake reply for ${route}`);
    const [status, payload] = typeof entry === "function" ? entry(body) : entry;
    const text = payload === undefined ? "" : JSON.stringify(payload);
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => text,
      json: async () => JSON.parse(text),
    } as Response;
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return {
    calls,
    count: (route: string) => calls.filter((c) => c.route === route).length,
    set: (route: string, reply: Reply | Handler) => {
      routes[route] = reply;
    },
  };
}

export const user = {
  id: "u1",
  email: "zywoo@example.test",
  displayName: "Zywoo",
  role: "admin" as const,
  createdAt: "2026-11-12T10:00:00.000Z",
};

export const signedOut = { message: "Sign in to access this resource" };
