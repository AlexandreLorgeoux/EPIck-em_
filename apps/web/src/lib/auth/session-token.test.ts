import { describe, expect, it } from "@jest/globals";
import { SignJWT, UnsecuredJWT } from "jose";
import { readAccessToken } from "./session-token";

const SECRET = "web-unit-test-secret-at-least-32-chars";
const sign = (claims: object, secret = SECRET, expires = "15m") =>
  new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("u1")
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(new TextEncoder().encode(secret));

describe("readAccessToken", () => {
  it("reads the user from a token signed with the shared secret", async () => {
    await expect(
      readAccessToken(await sign({ role: "admin" }), SECRET),
    ).resolves.toEqual({
      id: "u1",
      role: "admin",
    });
  });

  it("refuses an expired token", async () => {
    const expired = await sign({ role: "admin" }, SECRET, "-1s");
    await expect(readAccessToken(expired, SECRET)).resolves.toBeNull();
  });

  it("refuses a token signed with another secret", async () => {
    const forged = await sign(
      { role: "admin" },
      "another-secret-another-secret-12",
    );
    await expect(readAccessToken(forged, SECRET)).resolves.toBeNull();
  });

  it('refuses an unsigned token ("alg": "none")', async () => {
    const unsigned = new UnsecuredJWT({ role: "admin" })
      .setSubject("u1")
      .encode();
    await expect(readAccessToken(unsigned, SECRET)).resolves.toBeNull();
  });

  it("refuses an unknown role", async () => {
    await expect(
      readAccessToken(await sign({ role: "superadmin" }), SECRET),
    ).resolves.toBeNull();
  });

  it("refuses everything when the secret is not configured", async () => {
    await expect(
      readAccessToken(await sign({ role: "admin" }), undefined),
    ).resolves.toBeNull();
  });

  it("refuses a missing token or garbage", async () => {
    await expect(readAccessToken(undefined, SECRET)).resolves.toBeNull();
    await expect(readAccessToken("not.a.jwt", SECRET)).resolves.toBeNull();
  });
});
