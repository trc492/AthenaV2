import { createHash, timingSafeEqual } from "node:crypto";
import { mkdir, rmdir } from "node:fs/promises";
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

/** Serialize setup mutations across processes sharing this deployment's runtime volume. */
export async function withSetupLock(action: () => Promise<Response>): Promise<Response> {
  const directory = join(process.cwd(), ".runtime");
  const lock = join(directory, "setup.lock");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  try {
    await mkdir(lock);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    return NextResponse.json({ error: "Another setup change is in progress. Please retry." }, { status: 409 });
  }
  try {
    return await action();
  } finally {
    await rmdir(lock);
  }
}
