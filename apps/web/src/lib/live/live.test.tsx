/**
 * @jest-environment jsdom
 */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { act, cleanup, renderHook } from "@testing-library/react";
import { FakeEventSource } from "@/test/fake-event-source";
import { ANNOUNCE_EVERY_MS, useAnnouncer } from "./use-announcer";
import { LOST_AFTER_MS, useTournamentStream } from "./use-tournament-stream";

const pass = (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
const SETTLED = 1000;

let hidden = false;
beforeEach(() => {
  jest.useFakeTimers();
  FakeEventSource.install();
  hidden = false;
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => hidden,
  });
});
afterEach(() => {
  cleanup();
  jest.useRealTimers();
});

function follow() {
  const onChange = jest.fn(async () => {});
  const hook = renderHook(() => useTournamentStream("t1", onChange));
  return { onChange, ...hook };
}

describe("useTournamentStream", () => {
  it("reads once per version, after the events of a result settle", async () => {
    const { onChange, result } = follow();
    expect(FakeEventSource.last.url).toBe("/api/tournaments/t1/events");
    expect(result.current).toBe("connecting");
    act(() => FakeEventSource.last.sync("7"));
    expect(result.current).toBe("live");
    await pass(SETTLED);
    expect(onChange).toHaveBeenCalledTimes(1);
    act(() => FakeEventSource.last.change("8"));
    await pass(SETTLED);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("only reads again after a reconnection if something was missed", async () => {
    const { onChange } = follow();
    act(() => FakeEventSource.last.sync("7"));
    await pass(SETTLED);
    act(() => FakeEventSource.last.fail(false));
    act(() => FakeEventSource.last.sync("7"));
    await pass(SETTLED);
    expect(onChange).toHaveBeenCalledTimes(1);
    act(() => FakeEventSource.last.fail(false));
    act(() => FakeEventSource.last.sync("9"));
    await pass(SETTLED);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("says the connection is lost only when it lasts, then that it is back", async () => {
    const { result } = follow();
    act(() => FakeEventSource.last.sync("7"));
    act(() => FakeEventSource.last.fail(false));
    await pass(LOST_AFTER_MS - 100);
    expect(result.current).toBe("live");
    await pass(200);
    expect(result.current).toBe("lost");
    act(() => FakeEventSource.last.sync("7"));
    expect(result.current).toBe("live");
  });

  it("reopens what the browser gave up on, more and more slowly", async () => {
    follow();
    const gaps: number[] = [];
    for (let i = 0; i < 3; i++) {
      const before = FakeEventSource.all.length;
      act(() => FakeEventSource.last.fail(true));
      let waited = 0;
      while (FakeEventSource.all.length === before) {
        await pass(100);
        waited += 100;
      }
      gaps.push(waited);
    }
    expect(gaps[0]).toBeGreaterThanOrEqual(1000);
    expect(gaps[1]).toBeGreaterThanOrEqual(2000);
    expect(gaps[2]).toBeGreaterThanOrEqual(4000);
  });

  it("reads again later when reading failed", async () => {
    const { onChange } = follow();
    onChange.mockRejectedValueOnce(new Error("offline"));
    act(() => FakeEventSource.last.sync("7"));
    await pass(SETTLED);
    expect(onChange).toHaveBeenCalledTimes(1);
    await pass(5000);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("closes while the tab is hidden, and when the page goes", () => {
    const { unmount } = follow();
    const first = FakeEventSource.last;
    hidden = true;
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(first.readyState).toBe(FakeEventSource.CLOSED);
    hidden = false;
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(FakeEventSource.all).toHaveLength(2);
    unmount();
    expect(FakeEventSource.last.readyState).toBe(FakeEventSource.CLOSED);
  });
});

describe("useAnnouncer", () => {
  it("says the first at once, then at most one per period, the last one", async () => {
    const { result } = renderHook(() => useAnnouncer());
    act(() => result.current.announce(() => "A"));
    await pass(1);
    expect(result.current.message).toBe("A");
    for (const text of ["B", "C", "D"]) {
      act(() => result.current.announce(() => text));
      await pass(1000);
      expect(result.current.message).toBe("A");
    }
    await pass(ANNOUNCE_EVERY_MS);
    expect(result.current.message).toBe("D");
  });

  it("says nothing when there is nothing to say", async () => {
    const { result } = renderHook(() => useAnnouncer());
    act(() => result.current.announce(() => ""));
    await pass(1);
    expect(result.current.message).toBe("");
  });
});
