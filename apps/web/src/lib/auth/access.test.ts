import { describe, expect, it } from "@jest/globals";
import type { AccessRule } from "@/lib/routes";
import { decideAccess, ruleFor } from "./access";

const admin = { id: "u1", role: "admin" as const };
const player = { id: "u2", role: "player" as const };
const plainUser = { id: "u3", role: "user" as const };

describe("ruleFor (the project's rules)", () => {
  it.each(["/admin", "/admin/teams", "/admin/tournaments/42/results"])(
    "protects %s",
    (path) => {
      expect(ruleFor(path)).toEqual({ prefix: "/admin", allow: ["admin"] });
    },
  );

  it.each([
    "/",
    "/login",
    "/forbidden",
    "/tournaments",
    "/tournaments/spring-cup",
    "/administration",
    "/adminx",
  ])("leaves %s public", (path) => {
    expect(ruleFor(path)).toBeNull();
  });
});

describe("ruleFor (with nested rules)", () => {
  const rules: AccessRule[] = [
    { prefix: "/admin", allow: ["admin"] },
    { prefix: "/admin/help", allow: "signed-in" },
    { prefix: "/account", allow: "signed-in" },
  ];

  it("picks the most specific rule, whatever their order", () => {
    expect(ruleFor("/admin/help/faq", rules)?.prefix).toBe("/admin/help");
    expect(ruleFor("/admin/teams", rules)?.prefix).toBe("/admin");
    expect(ruleFor("/admin/help/faq", [...rules].reverse())?.prefix).toBe(
      "/admin/help",
    );
  });
});

describe("decideAccess", () => {
  it("lets anyone open a public page, signed in or not", () => {
    expect(decideAccess("/tournaments", "", null)).toEqual({ kind: "allow" });
    expect(decideAccess("/", "", plainUser)).toEqual({ kind: "allow" });
  });

  it("sends a signed-out visitor to login, keeping the page and its query", () => {
    expect(decideAccess("/admin/teams", "?page=2", null)).toEqual({
      kind: "login",
      location: "/login?next=%2Fadmin%2Fteams%3Fpage%3D2",
    });
  });

  it("lets an allowed role in", () => {
    expect(decideAccess("/admin/teams", "", admin)).toEqual({ kind: "allow" });
  });

  it.each([player, plainUser])(
    "answers forbidden to the $role role",
    (user) => {
      expect(decideAccess("/admin/teams", "", user)).toEqual({
        kind: "forbidden",
        location: "/forbidden",
      });
    },
  );

  it("lets any signed-in user through a signed-in rule", () => {
    const rules: AccessRule[] = [{ prefix: "/account", allow: "signed-in" }];
    expect(decideAccess("/account", "", plainUser, rules)).toEqual({
      kind: "allow",
    });
    expect(decideAccess("/account", "", null, rules).kind).toBe("login");
  });
});
