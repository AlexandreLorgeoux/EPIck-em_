import {
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { SignJWT } from "jose";
import {
  getRedirectUrl,
  getRewrittenUrl,
  isRewrite,
  unstable_doesMiddlewareMatch,
} from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { config, proxy } from "./proxy";

const SECRET = "web-unit-test-secret-at-least-32-chars";
const token = (role: string, expires = "15m") =>
  new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("u1")
    .setExpirationTime(expires)
    .sign(new TextEncoder().encode(SECRET));

const request = (path: string, cookie = "") =>
  new NextRequest(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie } : {},
  });

describe("proxy", () => {
  const realFetch = global.fetch;

  beforeAll(() => {
    process.env.AUTH_SECRET = SECRET;
    process.env.API_URL = "http://api.test";
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  it("lets public pages through without looking at the session", async () => {
    global.fetch = jest.fn() as unknown as typeof fetch;
    const response = await proxy(request("/tournaments/spring-cup"));
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor to login with the return path", async () => {
    const response = await proxy(request("/admin/teams?page=2"));
    expect(response.status).toBe(307);
    expect(getRedirectUrl(response)).toBe(
      "http://localhost:3000/login?next=%2Fadmin%2Fteams%3Fpage%3D2",
    );
  });

  it("treats an invalid token like no session", async () => {
    const response = await proxy(request("/admin", "access_token=forged"));
    expect(getRedirectUrl(response)).toBe(
      "http://localhost:3000/login?next=%2Fadmin",
    );
  });

  it("lets an admin in", async () => {
    const response = await proxy(
      request("/admin/teams", `access_token=${await token("admin")}`),
    );
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("shows the forbidden page, keeping the URL, to other roles", async () => {
    const response = await proxy(
      request("/admin/teams", `access_token=${await token("player")}`),
    );
    expect(isRewrite(response)).toBe(true);
    expect(getRewrittenUrl(response)).toBe("http://localhost:3000/forbidden");
  });

  describe("with an expired access token", () => {
    it("renews the session with the refresh cookie and lets the user in", async () => {
      const renewed = await token("admin");
      const fetchMock = jest.fn<typeof fetch>(
        async () =>
          new Response(JSON.stringify({ id: "u1", role: "admin" }), {
            status: 200,
            headers: [
              ["content-type", "application/json"],
              [
                "set-cookie",
                `access_token=${renewed}; Path=/; HttpOnly; SameSite=Lax`,
              ],
              [
                "set-cookie",
                "refresh_token=new-refresh; Path=/; HttpOnly; SameSite=Lax",
              ],
            ],
          }),
      );
      global.fetch = fetchMock;
      const expired = await token("admin", "-1s");

      const response = await proxy(
        request(
          "/admin",
          `access_token=${expired}; refresh_token=old-refresh; theme=dark`,
        ),
      );

      expect(fetchMock).toHaveBeenCalledWith(
        "http://api.test/auth/refresh",
        expect.objectContaining({ method: "POST" }),
      );
      expect(response.headers.get("x-middleware-next")).toBe("1");
      // The browser gets the new cookies...
      expect(response.headers.getSetCookie()).toEqual([
        `access_token=${renewed}; Path=/; HttpOnly; SameSite=Lax`,
        "refresh_token=new-refresh; Path=/; HttpOnly; SameSite=Lax",
      ]);
      // ...and the page rendered for this request already sees them
      const forwarded = response.headers.get("x-middleware-request-cookie");
      expect(forwarded).toContain(`access_token=${renewed}`);
      expect(forwarded).toContain("refresh_token=new-refresh");
      expect(forwarded).toContain("theme=dark");
    });

    it("sends the user to login when the refresh is refused", async () => {
      global.fetch = jest.fn(
        async () => new Response("{}", { status: 401 }),
      ) as unknown as typeof fetch;
      const expired = await token("admin", "-1s");

      const response = await proxy(
        request("/admin", `access_token=${expired}; refresh_token=revoked`),
      );

      expect(getRedirectUrl(response)).toBe(
        "http://localhost:3000/login?next=%2Fadmin",
      );
    });

    it("does not call the API without a refresh cookie", async () => {
      global.fetch = jest.fn() as unknown as typeof fetch;
      await proxy(
        request("/admin", `access_token=${await token("admin", "-1s")}`),
      );
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("sends the user to login when the API cannot be reached", async () => {
      global.fetch = jest.fn(async () => {
        throw new TypeError("fetch failed");
      }) as unknown as typeof fetch;
      const response = await proxy(request("/admin", "refresh_token=any"));
      expect(getRedirectUrl(response)).toBe(
        "http://localhost:3000/login?next=%2Fadmin",
      );
    });
  });
});

// Next 16 documents this helper as unstable_doesProxyMatch, but the package
// still exports it under its middleware name
describe("proxy matcher", () => {
  it.each(["/", "/admin", "/admin/teams", "/login", "/tournaments/spring-cup"])(
    "runs on the page %s",
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
    },
  );

  it.each([
    "/api/auth/me",
    "/_next/static/chunks/main.js",
    "/_next/image?url=%2Flogo.png&w=64&q=75",
    "/favicon.ico",
    "/logo.svg",
  ])("skips %s", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
  });
});
