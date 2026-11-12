/**
 * @jest-environment jsdom
 */
import { mockRouter } from "@/test/mock-navigation";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, render, screen, waitFor } from "@testing-library/react";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { fakeApi, signedOut, user } from "@/test/fake-api";
import {
  AuthProvider,
  SESSION_EXPIRED_MESSAGE,
  useAuth,
  type AuthContextValue,
} from "./auth-provider";

const mockReplace = mockRouter.replace;

// Runs an API call inside act() and returns what it resolved or threw
async function settle<T>(call: () => Promise<T>) {
  let outcome!: { value?: T; error?: unknown };
  await act(async () => {
    try {
      outcome = { value: await call() };
    } catch (error) {
      outcome = { error };
    }
  });
  return outcome;
}

// Renders the provider and exposes what useAuth() returns
function renderAuth() {
  const auth: { current: AuthContextValue | null } = { current: null };
  function Probe() {
    auth.current = useAuth();
    const { loading, user: current } = auth.current;
    return (
      <p data-testid="who">
        {loading ? "loading" : (current?.email ?? "nobody")}
      </p>
    );
  }
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  return () => auth.current!;
}

const who = () => screen.getByTestId("who").textContent;

describe("AuthProvider", () => {
  beforeEach(() => {
    mockReplace.mockClear();
    window.history.replaceState({}, "", "/");
  });

  it("loads the signed-in user and their role", async () => {
    fakeApi({ "GET /auth/me": [200, user] });
    const auth = renderAuth();

    expect(who()).toBe("loading");
    await waitFor(() => expect(who()).toBe("zywoo@example.test"));
    expect(auth().role).toBe("admin");
    expect(auth().loading).toBe(false);
  });

  it("treats a visitor with no session as signed out, without redirecting", async () => {
    fakeApi({
      "GET /auth/me": [401, signedOut],
      "POST /auth/refresh": [401, signedOut],
    });
    renderAuth();

    await waitFor(() => expect(who()).toBe("nobody"));
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toBe("");
  });

  describe("login", () => {
    beforeEach(() => {
      fakeApi({
        "GET /auth/me": [401, signedOut],
        "POST /auth/refresh": [401, signedOut],
        "POST /auth/login": [200, user],
      });
    });

    it("signs in, then goes back to the page the user came from", async () => {
      const auth = renderAuth();
      await waitFor(() => expect(who()).toBe("nobody"));

      await act(() => auth().login("zywoo@example.test", "pw", "/admin/teams"));

      expect(who()).toBe("zywoo@example.test");
      expect(mockReplace).toHaveBeenCalledWith("/admin/teams");
    });

    it("refuses to send the user to another site after signing in", async () => {
      const auth = renderAuth();
      await waitFor(() => expect(who()).toBe("nobody"));

      await act(() => auth().login("zywoo@example.test", "pw", "//evil.test"));

      expect(mockReplace).toHaveBeenCalledWith("/");
    });

    it("rejects with the API error and stays signed out on wrong credentials", async () => {
      const api = fakeApi({
        "GET /auth/me": [401, signedOut],
        "POST /auth/refresh": [401, signedOut],
        "POST /auth/login": [401, { message: "Invalid email or password" }],
      });
      const auth = renderAuth();
      await waitFor(() => expect(who()).toBe("nobody"));

      const error = await act(() =>
        auth()
          .login("zywoo@example.test", "wrong")
          .catch((e: unknown) => e),
      );

      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ status: 401 });
      expect(who()).toBe("nobody");
      // Wrong credentials are not an expired session: no refresh attempt
      expect(api.count("POST /auth/refresh")).toBe(1);
    });
  });

  describe("logout", () => {
    it("clears the session on the API, forgets the user and goes to login", async () => {
      const fake = fakeApi({
        "GET /auth/me": [200, user],
        "POST /auth/logout": [204],
      });
      const auth = renderAuth();
      await waitFor(() => expect(who()).toBe("zywoo@example.test"));

      await act(() => auth().logout());

      expect(fake.count("POST /auth/logout")).toBe(1);
      expect(who()).toBe("nobody");
      expect(mockReplace).toHaveBeenCalledWith("/login");
    });

    it("still signs out locally when the API cannot be reached", async () => {
      fakeApi({
        "GET /auth/me": [200, user],
        "POST /auth/logout": [503],
      });
      const auth = renderAuth();
      await waitFor(() => expect(who()).toBe("zywoo@example.test"));

      await act(() => auth().logout());

      expect(who()).toBe("nobody");
      expect(mockReplace).toHaveBeenCalledWith("/login");
    });
  });

  describe("refresh", () => {
    it("sends one request when several refreshes are asked together", async () => {
      const fake = fakeApi({
        "GET /auth/me": [200, user],
        "POST /auth/refresh": [200, { ...user, role: "player" }],
      });
      const auth = renderAuth();
      await waitFor(() => expect(who()).toBe("zywoo@example.test"));

      const results = await act(() =>
        Promise.all([auth().refresh(), auth().refresh(), auth().refresh()]),
      );

      expect(results).toEqual([true, true, true]);
      expect(fake.count("POST /auth/refresh")).toBe(1);
      // The refreshed session carries the current role
      expect(auth().role).toBe("player");
    });

    it("renews the session silently when a request gets a 401", async () => {
      const fake = fakeApi({
        "GET /auth/me": [200, user],
        "POST /auth/refresh": [200, user],
      });
      let teamsCalls = 0;
      fake.set("GET /teams", () =>
        ++teamsCalls === 1 ? [401, signedOut] : [200, []],
      );
      renderAuth();
      await waitFor(() => expect(who()).toBe("zywoo@example.test"));

      expect(await settle(() => api.get("/teams"))).toEqual({ value: [] });

      expect(fake.count("POST /auth/refresh")).toBe(1);
      expect(who()).toBe("zywoo@example.test");
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  describe("expired session", () => {
    it("announces it and sends the user to login, then back to the same page", async () => {
      const fake = fakeApi({ "GET /auth/me": [200, user] });
      renderAuth();
      await waitFor(() => expect(who()).toBe("zywoo@example.test"));
      window.history.replaceState({}, "", "/admin/teams?page=2");
      fake.set("GET /teams", [401, signedOut]);
      fake.set("POST /auth/refresh", [401, signedOut]);

      expect((await settle(() => api.get("/teams"))).error).toMatchObject({
        status: 401,
      });

      expect(who()).toBe("nobody");
      expect(screen.getByRole("status").textContent).toBe(
        SESSION_EXPIRED_MESSAGE,
      );
      expect(mockReplace).toHaveBeenCalledWith(
        "/login?next=%2Fadmin%2Fteams%3Fpage%3D2",
      );
    });

    it("refreshes only once when several requests fail together", async () => {
      const fake = fakeApi({ "GET /auth/me": [200, user] });
      renderAuth();
      await waitFor(() => expect(who()).toBe("zywoo@example.test"));
      fake.set("GET /teams", [401, signedOut]);
      fake.set("GET /players", [401, signedOut]);
      fake.set("POST /auth/refresh", [401, signedOut]);

      await act(() =>
        Promise.allSettled([
          api.get("/teams"),
          api.get("/players"),
          api.get("/teams"),
        ]),
      );

      expect(fake.count("POST /auth/refresh")).toBe(1);
      expect(mockReplace).toHaveBeenCalledTimes(1);
    });
  });

  it("explains a missing provider", () => {
    function Lost() {
      useAuth();
      return null;
    }
    jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Lost />)).toThrow(
      "useAuth must be used inside <AuthProvider>",
    );
  });
});
