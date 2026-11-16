import { createHmac, timingSafeEqual } from "node:crypto";
import { getAuthSecret } from "./runtime-secrets";

/**
 * Changing a password bumps the account's session version, which signs out
 * every existing session. The browser that made the change is handed this
 * short-lived proof so it alone can move its session to the new version.
 */
const TTL_MS = 60_000;

function signature(userId: string, sessionVersion: number, expiresAt: number) {
  return createHmac("sha256", getAuthSecret())
    .update(`session-refresh:v1:${userId}:${sessionVersion}:${expiresAt}`)
    .digest();
}

export function createSessionRefresh(userId: string, sessionVersion: number) {
  const expiresAt = Date.now() + TTL_MS;
  return `${expiresAt}.${signature(userId, sessionVersion, expiresAt).toString("base64url")}`;
}

export function verifySessionRefresh(
  userId: string,
  sessionVersion: number,
  token: unknown,
): boolean {
  if (typeof token !== "string" || token.length > 200) return false;
  const [expires, supplied, ...rest] = token.split(".");
  const expiresAt = Number(expires);
  if (rest.length || !supplied || !Number.isSafeInteger(expiresAt)) return false;
  if (expiresAt <= Date.now()) return false;
  const expected = signature(userId, sessionVersion, expiresAt);
  const actual = Buffer.from(supplied, "base64url");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
