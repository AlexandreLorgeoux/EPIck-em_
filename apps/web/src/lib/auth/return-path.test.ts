import { describe, expect, it } from "@jest/globals";
import { loginPath, safeReturnPath } from "./return-path";

describe("safeReturnPath", () => {
  it("keeps a path on this site, with its query", () => {
    expect(safeReturnPath("/admin/teams?page=2")).toBe("/admin/teams?page=2");
  });

  it.each([
    ["another site", "https://evil.test"],
    ["a protocol-relative URL", "//evil.test"],
    ["a backslash trick", "/\\evil.test"],
    ["a javascript: URL", "javascript:alert(1)"],
    ["a relative path", "teams"],
    ["the login page itself", "/login?next=/teams"],
    ["nothing", null],
  ])("falls back for %s", (_, value) => {
    expect(safeReturnPath(value)).toBe("/");
  });

  it("uses the given fallback", () => {
    expect(safeReturnPath("//evil.test", "/admin")).toBe("/admin");
  });
});

describe("loginPath", () => {
  it("carries the page to come back to", () => {
    expect(loginPath("/admin/teams?page=2")).toBe(
      "/login?next=%2Fadmin%2Fteams%3Fpage%3D2",
    );
  });

  it("drops a return path that is useless or unsafe", () => {
    expect(loginPath("/")).toBe("/login");
    expect(loginPath("//evil.test")).toBe("/login");
    expect(loginPath(undefined)).toBe("/login");
  });
});
