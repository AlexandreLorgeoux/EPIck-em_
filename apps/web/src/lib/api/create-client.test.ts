import { describe, expect, it, jest } from "@jest/globals";
import { createApiClient } from "./create-client";
import { ApiError } from "./errors";
import type { Team } from "./models";

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// A fetch that answers each call with the next response in the list
const fakeFetch = (...responses: (Response | Error)[]) => {
  const queue = [...responses];
  return jest.fn(async (_url: string, _init?: RequestInit) => {
    const next = queue.shift();
    if (!next) throw new Error("Unexpected extra request");
    if (next instanceof Error) throw next;
    return next;
  });
};

const setup = (
  fetchMock: ReturnType<typeof fakeFetch>,
  extra: Partial<Parameters<typeof createApiClient>[0]> = {},
) =>
  createApiClient({
    baseUrl: "https://api.test/",
    fetch: fetchMock as unknown as typeof fetch,
    ...extra,
  });

describe("createApiClient", () => {
  it("calls the path under the base URL and adds the query", async () => {
    const fetchMock = fakeFetch(json(200, []));
    await setup(fetchMock).get("/teams", { query: { search: "a b" } });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.test/teams?search=a+b",
    );
  });

  it("leaves out query values that are undefined", async () => {
    const fetchMock = fakeFetch(json(200, []));
    await setup(fetchMock).get("/players", { query: { search: undefined } });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/players");
  });

  it("sends JSON bodies with cookies and returns the parsed response", async () => {
    const team: Team = {
      id: "1",
      name: "Alpha",
      tag: null,
      captainPlayerId: null,
      members: [],
    };
    const fetchMock = fakeFetch(json(201, team));

    const result = await setup(fetchMock).post<Team>("/teams", {
      name: "Alpha",
    });

    expect(result).toEqual(team);
    const init = fetchMock.mock.calls[0][1]!;
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(init.body).toBe('{"name":"Alpha"}');
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
  });

  it("uses the method of each function", async () => {
    const fetchMock = fakeFetch(
      json(200, {}),
      json(200, {}),
      json(200, {}),
      new Response(null, { status: 204 }),
    );
    const api = setup(fetchMock);
    await api.get("/auth/me");
    await api.patch("/teams/1", { name: "Beta" });
    await api.put("/teams/1", { name: "Beta" });
    await api.delete("/teams/1");
    expect(fetchMock.mock.calls.map(([, init]) => init!.method)).toEqual([
      "GET",
      "PATCH",
      "PUT",
      "DELETE",
    ]);
  });

  it("sends no body and no JSON header when there is no body", async () => {
    const fetchMock = fakeFetch(json(200, {}));
    await setup(fetchMock).post("/auth/refresh");
    const init = fetchMock.mock.calls[0][1]!;
    expect(init.body).toBeUndefined();
    expect(init.headers).not.toHaveProperty("Content-Type");
  });

  it("returns undefined for an empty 204 response", async () => {
    const fetchMock = fakeFetch(new Response(null, { status: 204 }));
    await expect(
      setup(fetchMock).delete("/players/1"),
    ).resolves.toBeUndefined();
  });

  it("adds the configured headers, such as a forwarded cookie", async () => {
    const fetchMock = fakeFetch(json(200, {}));
    await setup(fetchMock, { headers: { cookie: "access_token=abc" } }).get(
      "/auth/me",
    );
    expect(fetchMock.mock.calls[0][1]!.headers).toMatchObject({
      cookie: "access_token=abc",
    });
  });

  it("turns a validation error into an ApiError with messages per field", async () => {
    const fetchMock = fakeFetch(
      json(400, {
        statusCode: 400,
        message: ["name must be between 2 and 64 characters"],
        errors: { name: ["name must be between 2 and 64 characters"] },
      }),
    );

    const error = await setup(fetchMock)
      .post("/teams", { name: "A" })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      message: "name must be between 2 and 64 characters",
    });
    expect((error as ApiError).fieldError("name")).toBe(
      "name must be between 2 and 64 characters",
    );
    expect((error as ApiError).fieldError("tag")).toBeUndefined();
  });

  it("keeps a single error message as it is", async () => {
    const fetchMock = fakeFetch(
      json(409, { statusCode: 409, message: "Already taken" }),
    );
    await expect(
      setup(fetchMock).post("/teams", { name: "Alpha" }),
    ).rejects.toMatchObject({
      status: 409,
      messages: ["Already taken"],
      fieldErrors: {},
    });
  });

  it("still reports the status when the error body is not JSON", async () => {
    const fetchMock = fakeFetch(
      new Response("<html>Bad gateway</html>", { status: 502 }),
    );
    await expect(setup(fetchMock).get("/auth/me")).rejects.toMatchObject({
      status: 502,
      message: "The request failed (status 502)",
    });
  });

  it("reports a network failure as status 0 with a readable message", async () => {
    const fetchMock = fakeFetch(new TypeError("fetch failed"));
    await expect(setup(fetchMock).get("/auth/me")).rejects.toMatchObject({
      status: 0,
      message: "Cannot reach the server: check your connection and try again",
    });
  });

  describe("on a 401", () => {
    it("renews the session once and sends the request again", async () => {
      const fetchMock = fakeFetch(json(401, {}), json(200, { id: "u1" }));
      const onUnauthorized = jest.fn(async () => true);

      await expect(
        setup(fetchMock, { onUnauthorized }).get("/auth/me"),
      ).resolves.toEqual({ id: "u1" });
      expect(onUnauthorized).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("gives up when the session cannot be renewed", async () => {
      const fetchMock = fakeFetch(
        json(401, { message: "Sign in to access this resource" }),
      );
      const onUnauthorized = jest.fn(async () => false);

      await expect(
        setup(fetchMock, { onUnauthorized }).get("/teams"),
      ).rejects.toMatchObject({ status: 401 });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("does not loop when the retried request is refused again", async () => {
      const fetchMock = fakeFetch(json(401, {}), json(401, {}));
      const onUnauthorized = jest.fn(async () => true);

      await expect(
        setup(fetchMock, { onUnauthorized }).get("/teams"),
      ).rejects.toMatchObject({ status: 401 });
      expect(onUnauthorized).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("does not try to refresh for wrong credentials at sign-in", async () => {
      const fetchMock = fakeFetch(
        json(401, { message: "Invalid email or password" }),
      );
      const onUnauthorized = jest.fn(async () => true);

      await expect(
        setup(fetchMock, { onUnauthorized }).post("/auth/login", {
          email: "a@b.test",
          password: "wrong",
        }),
      ).rejects.toMatchObject({
        status: 401,
        message: "Invalid email or password",
      });
      expect(onUnauthorized).not.toHaveBeenCalled();
    });
  });
});
