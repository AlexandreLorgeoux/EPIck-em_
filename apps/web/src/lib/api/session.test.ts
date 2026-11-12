import { describe, expect, it, jest } from "@jest/globals";
import { singleFlight } from "./session";

describe("singleFlight", () => {
  it("runs one call for everyone who asks while it is running", async () => {
    let resolve!: (value: boolean) => void;
    const refresh = jest.fn(() => new Promise<boolean>((r) => (resolve = r)));
    const once = singleFlight(refresh);

    const results = Promise.all([once(), once(), once()]);
    resolve(true);

    await expect(results).resolves.toEqual([true, true, true]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("runs again once the previous call has finished", async () => {
    const refresh = jest.fn(async () => true);
    const once = singleFlight(refresh);

    await once();
    await once();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("runs again after a failure", async () => {
    const refresh = jest
      .fn<() => Promise<boolean>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(true);
    const once = singleFlight(refresh);

    await expect(once()).rejects.toThrow("offline");
    await expect(once()).resolves.toBe(true);
  });
});
