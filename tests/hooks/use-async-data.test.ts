// @vitest-environment happy-dom
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAsyncData } from "@/hooks/use-async-data";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useAsyncData", () => {
  it("loads data for the key", async () => {
    const { result } = renderHook(() => useAsyncData("teams", async () => [254]));

    expect(result.current).toMatchObject({ data: undefined, loading: true, error: null });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toMatchObject({ data: [254], error: null });
  });

  it("does nothing for a null key", () => {
    const load = vi.fn(async () => 1);
    const { result } = renderHook(() => useAsyncData(null, load));

    expect(result.current).toMatchObject({ data: undefined, loading: false, error: null });
    expect(load).not.toHaveBeenCalled();
  });

  it("surfaces load errors", async () => {
    const failure = new Error("offline");
    const { result } = renderHook(() =>
      useAsyncData("teams", () => Promise.reject(failure)),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toMatchObject({ data: undefined, error: failure });
  });

  it("never lets a slow response for an old key overwrite the new key", async () => {
    const slow = deferred<string>();
    const fast = deferred<string>();
    const loads: Record<string, Promise<string>> = { a: slow.promise, b: fast.promise };

    const { result, rerender } = renderHook(({ k }) => useAsyncData(k, () => loads[k]), {
      initialProps: { k: "a" },
    });
    rerender({ k: "b" });

    await act(async () => fast.resolve("B"));
    await act(async () => slow.resolve("A"));

    expect(result.current).toMatchObject({ data: "B", loading: false });
  });

  it("keeps showing data while a same-key reload is in flight", async () => {
    let value = 1;
    let pending = deferred<number>();
    const load = vi.fn(() => (value === 1 ? Promise.resolve(value) : pending.promise));
    const { result } = renderHook(() => useAsyncData("count", load));
    await waitFor(() => expect(result.current.data).toBe(1));

    value = 2;
    pending = deferred<number>();
    act(() => result.current.reload());

    expect(result.current).toMatchObject({ data: 1, loading: true });
    await act(async () => pending.resolve(2));
    expect(result.current).toMatchObject({ data: 2, loading: false });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("drops data from the previous key while the new key loads", async () => {
    const next = deferred<string>();
    const { result, rerender } = renderHook(
      ({ k }) => useAsyncData(k, () => (k === "a" ? Promise.resolve("A") : next.promise)),
      { initialProps: { k: "a" } },
    );
    await waitFor(() => expect(result.current.data).toBe("A"));

    rerender({ k: "b" });

    expect(result.current).toMatchObject({ data: undefined, loading: true });
  });
});
