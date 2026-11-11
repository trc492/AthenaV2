import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";

const { auth, getService, getById, updateUser } = vi.hoisted(() => ({
  auth: vi.fn(), getService: vi.fn(), getById: vi.fn(), updateUser: vi.fn(),
}));
vi.mock("@/lib/auth/config", () => ({ auth }));
vi.mock("@/db/database-manager", () => ({ databaseManager: { getService } }));
import { PUT } from "@/app/api/users/me/password/route";

function request(body: unknown) {
  return new NextRequest("http://localhost/api/users/me/password", {
    method: "PUT", body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("changing your own password", () => {
  let passwordHash: string;
  beforeAll(async () => { passwordHash = await bcrypt.hash("old-password", 4); });
  beforeEach(() => {
    vi.clearAllMocks();
    auth.mockResolvedValue({ user: { id: "scout-1", role: "scout" } });
    getById.mockResolvedValue({ id: "scout-1", password_hash: passwordHash });
    getService.mockReturnValue({ users: { getById }, updateUser });
    updateUser.mockResolvedValue(undefined);
  });

  it("requires a signed-in account before accessing persistence", async () => {
    auth.mockResolvedValue(null);
    expect((await PUT(request({}))).status).toBe(401);
    expect(getService).not.toHaveBeenCalled();
  });

  it.each([
    null, {}, { newPassword: "12345678" }, { currentPassword: "old-password" },
    { currentPassword: 123, newPassword: "12345678" },
    { currentPassword: "old-password", newPassword: ["12345678"] },
    { currentPassword: "old-password", newPassword: "" },
    { currentPassword: "old-password", newPassword: "1234567" },
  ])("rejects missing, malformed or short credentials: %j", async (body) => {
    expect((await PUT(request(body))).status).toBe(400);
    expect(getService).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON without writing", async () => {
    const response = await PUT(new NextRequest("http://localhost/api/users/me/password", {
      method: "PUT", body: "{",
    }));
    expect(response.status).toBe(400);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("rejects the wrong current password without changing the hash", async () => {
    expect((await PUT(request({ currentPassword: "wrong", newPassword: "12345678" }))).status).toBe(400);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("accepts exactly eight characters and stores a working hash for the session account", async () => {
    const response = await PUT(request({
      currentPassword: "old-password", newPassword: "12345678", userId: "someone-else",
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(getById).toHaveBeenCalledWith("scout-1");
    expect(updateUser).toHaveBeenCalledTimes(1);
    const [id, updates] = updateUser.mock.calls[0];
    expect(id).toBe("scout-1");
    expect(updates.passwordHash).not.toBe("12345678");
    expect(await bcrypt.compare("12345678", updates.passwordHash)).toBe(true);
    expect(await bcrypt.compare("old-password", updates.passwordHash)).toBe(false);
  });

  it("throttles repeated password guesses before reading or hashing again", async () => {
    auth.mockResolvedValue({ user: { id: "throttled-scout", role: "scout" } });
    for (let attempt = 0; attempt < 10; attempt++) {
      expect((await PUT(request({ currentPassword: "wrong", newPassword: "12345678" }))).status).toBe(400);
    }
    getById.mockClear();
    const limited = await PUT(request({ currentPassword: "wrong", newPassword: "12345678" }));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBeTruthy();
    expect(getById).not.toHaveBeenCalled();
  });

  it("does not update a missing account", async () => {
    getById.mockResolvedValue(undefined);
    expect((await PUT(request({ currentPassword: "old-password", newPassword: "12345678" }))).status).toBe(404);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("does not report success when persistence fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    updateUser.mockRejectedValue(new Error("Database unavailable"));
    const response = await PUT(request({ currentPassword: "old-password", newPassword: "12345678" }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Failed to update password" });
  });
});
