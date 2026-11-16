import { createHash, timingSafeEqual } from "node:crypto";
import { mkdir, rmdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { getSetupToken } from "./runtime-secrets";

export function requireSetupToken(request: Request): NextResponse | null {
  let expected: string;
  try {
    expected = getSetupToken();
  } catch {
    return NextResponse.json({ error: "Setup is locked. Configure SETUP_TOKEN on the server." }, { status: 503 });
  }
  const supplied = request.headers.get("x-athena-setup-token") ?? "";
  const digest = (value: string) => createHash("sha256").update(value).digest();
  if (!timingSafeEqual(digest(supplied), digest(expected))) {
    return NextResponse.json({ error: "A valid setup token is required." }, { status: 403 });
  }
  return null;
}

/** No setup step runs this long; an older lock belongs to a dead process. */
const STALE_LOCK_MS = 5 * 60_000;

/** Serialize setup mutations across processes sharing this deployment's runtime volume. */
export async function withSetupLock(action: () => Promise<Response>): Promise<Response> {
  const directory = join(process.cwd(), ".runtime");
  const lock = join(directory, "setup.lock");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const busy = () =>
    NextResponse.json({ error: "Another setup change is in progress. Please retry." }, { status: 409 });
  try {
    await mkdir(lock);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    // A process that died while holding the lock would otherwise block setup
    // until someone deleted the directory by hand.
    const heldSince = await stat(lock).then((info) => info.mtimeMs, () => null);
    if (heldSince !== null && Date.now() - heldSince < STALE_LOCK_MS) return busy();
    await rmdir(lock).catch(() => {});
    try {
      await mkdir(lock);
    } catch (retryError) {
      if ((retryError as NodeJS.ErrnoException).code !== "EEXIST") throw retryError;
      return busy();
    }
  }
  try {
    return await action();
  } finally {
    // Never let cleanup replace the action's own response or error.
    await rmdir(lock).catch(() => {});
  }
}
