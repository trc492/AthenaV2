import { randomUUID } from "node:crypto";
import { rename, unlink, writeFile } from "node:fs/promises";

/**
 * Writes deployment state that may hold credentials. The file is only ever
 * readable by the server's own user, and a crash mid-write leaves the previous
 * version in place instead of a truncated one.
 */
export async function writePrivateFile(
  path: string,
  content: string,
): Promise<void> {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, content, { encoding: "utf8", mode: 0o600 });
  try {
    await rename(temporary, path);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
}
