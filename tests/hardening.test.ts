import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  createSessionRefresh,
  verifySessionRefresh,
} from "@/lib/server/session-refresh";
import { withSetupLock } from "@/lib/server/setup-access";

vi.mock("@/db/database-manager", () => ({ databaseManager: {} }));
import { parseSubscription } from "@/lib/notifications";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("session refresh after a password change", () => {
  beforeEach(() => vi.stubEnv("AUTH_SECRET", "hardening-test-secret"));

  it("accepts only the matching account and session version", () => {
    const token = createSessionRefresh("user-1", 4);
    expect(verifySessionRefresh("user-1", 4, token)).toBe(true);
    expect(verifySessionRefresh("user-2", 4, token)).toBe(false);
    expect(verifySessionRefresh("user-1", 5, token)).toBe(false);
    expect(verifySessionRefresh("user-1", 4, `${token}x`)).toBe(false);
    expect(verifySessionRefresh("user-1", 4, undefined)).toBe(false);
  });

  it("expires after a minute", () => {
    vi.useFakeTimers();
    const token = createSessionRefresh("user-1", 1);
    vi.advanceTimersByTime(61_000);
    expect(verifySessionRefresh("user-1", 1, token)).toBe(false);
  });
});

describe("sign-in rate limiting without a trusted client IP", () => {
  it("limits each account separately instead of the whole deployment", () => {
    vi.stubEnv("RATE_LIMIT_IP_HEADER", "");
    const attempt = (subject?: string) =>
      checkRateLimit(new NextRequest("http://test"), {
        keyPrefix: "subject-test",
        windowMs: 60_000,
        maxRequests: 1,
        subject,
      }).limited;
    expect(attempt("user:alice")).toBe(false);
    expect(attempt("user:alice")).toBe(true);
    expect(attempt("user:bob")).toBe(false);
  });
});

describe("push subscription validation", () => {
  const keys = { p256dh: "key", auth: "secret" };

  it("accepts a browser push service endpoint and drops extra fields", () => {
    expect(
      parseSubscription({
        endpoint: "https://fcm.googleapis.com/fcm/send/abc",
        keys,
        expirationTime: null,
      }),
    ).toEqual({ endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys });
  });

  it("rejects endpoints the server should never be made to call", () => {
    for (const endpoint of [
      "http://fcm.googleapis.com/fcm/send/abc",
      "https://localhost/push",
      "https://169.254.169.254/latest/meta-data",
      "https://[::1]/push",
      "https://database.internal/push",
      "https://intranet/push",
      "not a url",
    ]) {
      expect(parseSubscription({ endpoint, keys })).toBeNull();
    }
    expect(
      parseSubscription({ endpoint: "https://push.example.com/x" }),
    ).toBeNull();
    expect(parseSubscription(null)).toBeNull();
  });
});

describe("setup lock recovery", () => {
  let directory: string;
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "athena-lock-"));
    vi.spyOn(process, "cwd").mockReturnValue(directory);
  });
  afterEach(() => rmSync(directory, { recursive: true, force: true }));

  it("takes over a lock left behind by a process that died", async () => {
    const lock = join(directory, ".runtime", "setup.lock");
    mkdirSync(lock, { recursive: true });
    const longAgo = new Date(Date.now() - 10 * 60_000);
    utimesSync(lock, longAgo, longAgo);
    expect((await withSetupLock(async () => new Response("ok"))).status).toBe(200);
  });

  it("still respects a lock that was taken moments ago", async () => {
    mkdirSync(join(directory, ".runtime", "setup.lock"), { recursive: true });
    const action = vi.fn(async () => new Response("unexpected"));
    expect((await withSetupLock(action)).status).toBe(409);
    expect(action).not.toHaveBeenCalled();
  });
});
