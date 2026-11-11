import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Server runtime only. Never import this module into client components. */
function developmentSecret(filename: string): string {
  // Exclude operator state from startup/proxy traces as well as route traces.
  // Keep the path annotations: ignoring only readFileSync still traces files.
  const directory = join(/* turbopackIgnore: true */ process.cwd(), ".runtime");
  const path = join(/* turbopackIgnore: true */ directory, filename);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  try {
    writeFileSync(path, JSON.stringify({ secret: randomBytes(48).toString("hex") }), {
      flag: "wx", mode: 0o600,
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  const value = JSON.parse(readFileSync(/* turbopackIgnore: true */ path, "utf8")).secret;
  if (typeof value !== "string" || value.length < 32) {
    throw new Error(`Invalid development secret in ${filename}`);
  }
  return value;
}

export function getAuthSecret(): string {
  const value = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (value) {
    if (process.env.NODE_ENV === "production" && value.length < 32) {
      throw new Error("AUTH_SECRET must contain at least 32 characters in production");
    }
    return value;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Set AUTH_SECRET at runtime before starting the production server");
  }
  return developmentSecret("auth-secret.json");
}

export function getSetupToken(): string {
  const value = process.env.SETUP_TOKEN;
  if (value && value.length >= 32) return value;
  if (process.env.NODE_ENV === "production" || value) {
    throw new Error("Set SETUP_TOKEN to at least 32 random characters to initialize this deployment");
  }
  return developmentSecret("setup-token.json");
}
