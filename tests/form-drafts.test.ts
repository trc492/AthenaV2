import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DRAFT_MAX_AGE_MS,
  clearDraft,
  draftKey,
  loadDraft,
  sameFormValues,
  saveDraft,
} from "@/lib/form-drafts";

function memoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    store,
  };
}

describe("form drafts", () => {
  let storage: ReturnType<typeof memoryStorage>;

  beforeEach(() => {
    storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);
  });

  it("builds keys only when every part is present", () => {
    expect(draftKey("match", ["u1", "FRC-2026", "2026casj"])).toBe(
      "athena-draft:match:u1:FRC-2026:2026casj",
    );
    expect(draftKey("match", ["u1", "FRC-2026", undefined])).toBeNull();
    expect(draftKey("pit", [null, "FRC-2026", "x"])).toBeNull();
    expect(draftKey("pit", ["", "FRC-2026", "x"])).toBeNull();
  });

  it("round-trips, clears, and expires drafts", () => {
    const now = 1_000_000;
    saveDraft("k", { teleop: { coral: 3 } }, now);
    expect(loadDraft("k", now + 1000)).toEqual({ teleop: { coral: 3 } });

    clearDraft("k");
    expect(loadDraft("k", now)).toBeNull();

    saveDraft("k", { a: 1 }, now);
    expect(loadDraft("k", now + DRAFT_MAX_AGE_MS + 1)).toBeNull();
    expect(storage.store.has("k")).toBe(false);
  });

  it("ignores corrupt or foreign data", () => {
    storage.setItem("bad", "{not json");
    expect(loadDraft("bad")).toBeNull();
    storage.setItem("old", JSON.stringify({ v: 0, savedAt: Date.now(), data: {} }));
    expect(loadDraft("old")).toBeNull();
  });

  it("survives unavailable storage", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => { throw new Error("denied"); },
      setItem: () => { throw new Error("quota"); },
      removeItem: () => { throw new Error("denied"); },
    });
    expect(() => saveDraft("k", { a: 1 })).not.toThrow();
    expect(loadDraft("k")).toBeNull();
    expect(() => clearDraft("k")).not.toThrow();
  });

  it("compares form values structurally, ignoring key order", () => {
    expect(sameFormValues({ a: 1, b: { c: [1, "x"] } }, { b: { c: [1, "x"] }, a: 1 })).toBe(true);
    expect(sameFormValues({ a: 0 }, { a: 1 })).toBe(false);
    expect(sameFormValues({ tags: ["a"] }, { tags: ["a", "b"] })).toBe(false);
    expect(sameFormValues({ notes: "" }, { notes: "hi" })).toBe(false);
  });
});
