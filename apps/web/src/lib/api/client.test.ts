import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { api } from "./client";
import { setSessionHandlers } from "./session";

const json = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("api (browser client)", () => {
  const realFetch = global.fetch;

  afterEach(() => {
    global.fetch = realFetch;
    setSessionHandlers(null);
  });

  it("calls the API through /api, the Next.js proxy", async () => {
    const fetchMock = jest.fn<typeof fetch>(async () =>
      json(200, { id: "u1" }),
    );
    global.fetch = fetchMock;

    await api.get("/auth/me");
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/me", expect.anything());
  });

  it("refreshes once through the AuthProvider when several calls get a 401", async () => {
    let calls = 0;
    // The first three calls are refused, the retries succeed
    global.fetch = jest.fn(async () =>
      ++calls <= 3 ? json(401) : json(200, []),
    ) as unknown as typeof fetch;
    const refresh = jest.fn(async () => true);
    const onExpired = jest.fn();
    setSessionHandlers({ refresh, onExpired });

    await Promise.all([
      api.get("/teams"),
      api.get("/players"),
      api.get("/users"),
    ]);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onExpired).not.toHaveBeenCalled();
  });

  it("signs the user out when the refresh fails", async () => {
    global.fetch = jest.fn(async () => json(401)) as unknown as typeof fetch;
    const onExpired = jest.fn();
    setSessionHandlers({ refresh: async () => false, onExpired });

    await expect(api.get("/teams")).rejects.toMatchObject({ status: 401 });
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it("refreshes through /auth/refresh itself before an AuthProvider exists", async () => {
    const fetchMock = jest
      .fn<(url: string) => Promise<Response>>()
      .mockResolvedValueOnce(json(401))
      .mockResolvedValueOnce(json(200, { id: "u1" }))
      .mockResolvedValueOnce(json(200, { id: "u1" }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await api.get("/auth/me");
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/auth/me",
      "/api/auth/refresh",
      "/api/auth/me",
    ]);
  });
});
