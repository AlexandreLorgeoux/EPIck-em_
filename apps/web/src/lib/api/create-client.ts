import { ApiError } from "./errors";

export interface ClientConfig {
  baseUrl: string;
  fetch?: typeof fetch;
  // Extra headers on every request, for example the forwarded cookie
  headers?: Record<string, string>;
  // Called once when a request answers 401. Resolves true when the session
  // was renewed, and the request is then sent again one time.
  onUnauthorized?: () => Promise<boolean>;
}

export interface RequestOptions {
  // Added to the URL; undefined values are left out
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

// T is the type of the response: api.get<Team>(`/teams/${id}`)
export interface ApiClient {
  get<T = unknown>(path: string, options?: RequestOptions): Promise<T>;
  post<T = unknown>(
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<T>;
  patch<T = unknown>(
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<T>;
  put<T = unknown>(
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<T>;
  delete<T = void>(path: string, options?: RequestOptions): Promise<T>;
}

// A 401 on these means wrong credentials or a dead session, not an expired
// access token: refreshing would be pointless or loop
const NO_REFRESH = new Set([
  "/auth/login",
  "/auth/register",
  "/auth/refresh",
  "/auth/logout",
]);

function buildUrl(baseUrl: string, path: string, options: RequestOptions) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) query.set(key, String(value));
  }
  const search = query.size ? `?${query}` : "";
  return `${baseUrl.replace(/\/$/, "")}${path}${search}`;
}

export function createApiClient(config: ClientConfig): ApiClient {
  // Looked up at each call, not at creation: Next.js and test tools replace
  // the global fetch after this module has loaded
  const fetchFn: typeof fetch = (input, init) =>
    (config.fetch ?? globalThis.fetch)(input, init);

  async function send<T>(
    method: Method,
    path: string,
    body: unknown,
    options: RequestOptions = {},
  ): Promise<T> {
    const url = buildUrl(config.baseUrl, path, options);
    const hasBody = body !== undefined;
    const init: RequestInit = {
      method,
      // Sends the session cookies, also when the API is on another origin
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
        ...config.headers,
        ...options.headers,
      },
      body: hasBody ? JSON.stringify(body) : undefined,
      signal: options.signal,
    };

    const attempt = async () => {
      try {
        return await fetchFn(url, init);
      } catch (error) {
        if ((error as Error).name === "AbortError") throw error;
        throw ApiError.network();
      }
    };

    let res = await attempt();
    if (
      res.status === 401 &&
      config.onUnauthorized &&
      !NO_REFRESH.has(path) &&
      (await config.onUnauthorized())
    ) {
      res = await attempt();
    }
    if (!res.ok) throw await ApiError.fromResponse(res);

    // 204 No Content, or an empty body
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  return {
    get: (path, options) => send("GET", path, undefined, options),
    post: (path, body, options) => send("POST", path, body, options),
    patch: (path, body, options) => send("PATCH", path, body, options),
    put: (path, body, options) => send("PUT", path, body, options),
    delete: (path, options) => send("DELETE", path, undefined, options),
  };
}
