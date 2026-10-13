import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startActivePolling } from "@/lib/active-polling";

let tab: EventTarget;
let page: EventTarget & { visibilityState: string };
let network: { onLine: boolean };
let stop: (() => void) | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  tab = new EventTarget();
  page = Object.assign(new EventTarget(), { visibilityState: "visible" });
  network = { onLine: true };
  vi.stubGlobal("window", Object.assign(tab, { setInterval, clearInterval }));
  vi.stubGlobal("document", page);
  vi.stubGlobal("navigator", network);
});
afterEach(() => {
  stop?.();
  stop = undefined;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("activity-aware database polling", () => {
  it("polls active tabs, stops after five minutes idle, and refreshes on renewed activity", () => {
    const refresh = vi.fn();
    stop = startActivePolling(refresh, 30_000);
    vi.advanceTimersByTime(30_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5 * 60_000);
    const callsBeforeIdle = refresh.mock.calls.length;
    vi.advanceTimersByTime(60 * 60_000);
    expect(refresh).toHaveBeenCalledTimes(callsBeforeIdle);
    tab.dispatchEvent(new Event("pointerdown"));
    expect(refresh).toHaveBeenCalledTimes(callsBeforeIdle + 1);
    tab.dispatchEvent(new Event("keydown"));
    expect(refresh).toHaveBeenCalledTimes(callsBeforeIdle + 1);
  });

  it("does not poll hidden tabs and refreshes when visible again", () => {
    const refresh = vi.fn();
    stop = startActivePolling(refresh, 30_000);
    page.visibilityState = "hidden";
    vi.advanceTimersByTime(60 * 60_000);
    expect(refresh).not.toHaveBeenCalled();
    page.visibilityState = "visible";
    page.dispatchEvent(new Event("visibilitychange"));
    expect(refresh).toHaveBeenCalledTimes(1);
    tab.dispatchEvent(new Event("focus"));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("skips offline requests and refreshes when connectivity returns", () => {
    const refresh = vi.fn();
    stop = startActivePolling(refresh, 30_000);
    network.onLine = false;
    vi.advanceTimersByTime(60_000);
    expect(refresh).not.toHaveBeenCalled();
    network.onLine = true;
    tab.dispatchEvent(new Event("online"));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("removes timers and listeners when the component leaves", () => {
    const refresh = vi.fn();
    stop = startActivePolling(refresh, 30_000);
    stop();
    vi.advanceTimersByTime(60_000);
    tab.dispatchEvent(new Event("pointerdown"));
    page.dispatchEvent(new Event("visibilitychange"));
    expect(refresh).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
