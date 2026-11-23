import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { SignJWT } from "jose";

const updateTag = jest.fn();
const cookie = { value: undefined as string | undefined };

jest.mock("next/cache", () => ({ updateTag }));
jest.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (cookie.value ? { value: cookie.value } : undefined),
  }),
}));

const SECRET = "test-secret-at-least-32-characters-long";

const tokenFor = (role: string) =>
  new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("u1")
    .setExpirationTime("5m")
    .sign(new TextEncoder().encode(SECRET));

// Loaded after the mocks above: Next's test compiler keeps import order
const load = async () =>
  (await import("./refresh-public")).refreshPublicTournament;

describe("refreshPublicTournament", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = SECRET;
    updateTag.mockClear();
    cookie.value = undefined;
  });

  it("expires the tournament page and the list for an admin", async () => {
    cookie.value = await tokenFor("admin");
    await (
      await load()
    )("winter-cup");
    expect(updateTag.mock.calls).toEqual([
      ["tournament:winter-cup"],
      ["tournaments"],
    ]);
  });

  it.each([
    ["a visitor", undefined],
    ["a player", "player"],
    ["a user", "user"],
  ])("does nothing for %s", async (_who, role) => {
    cookie.value = role ? await tokenFor(role) : undefined;
    await (
      await load()
    )("winter-cup");
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("ignores a slug that cannot be one", async () => {
    cookie.value = await tokenFor("admin");
    const refresh = await load();
    await refresh("");
    await refresh("x".repeat(201));
    expect(updateTag).not.toHaveBeenCalled();
  });
});
