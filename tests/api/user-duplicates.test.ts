import { beforeEach, describe, expect, it, vi } from "vitest";

const { query, hash } = vi.hoisted(() => ({ query: vi.fn(), hash: vi.fn() }));
vi.mock("@/db/database-manager", async () => {
  const { sqlUsers } = await import("@/db/sql-users");
  return {
    databaseManager: {
      getService: () => ({ users: sqlUsers(query, "azuresql") }),
    },
  };
});
vi.mock("bcryptjs", () => ({ default: { hash } }));
import { createUser } from "@/lib/server/user-service";

const account = {
  name: " Jane  Doe ",
  username: "jane_new",
  password: "password123",
};

describe("duplicate account prevention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query.mockResolvedValue({ recordset: [] });
    hash.mockResolvedValue("hashed-password");
  });

  it("blocks a public signup with the same normalized name and a different username", async () => {
    query
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({
        recordset: [{ name: "\uFF2A\uFF21\uFF2E\uFF25 Doe" }],
      });
    const result = await createUser(account, { preventDuplicateName: true });
    expect(result).toMatchObject({
      success: false,
      status: 409,
      code: "DUPLICATE_ACCOUNT",
    });
    expect(hash).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("allows an admin to create an account for someone who shares a name", async () => {
    expect(await createUser(account)).toMatchObject({
      success: true,
      status: 201,
    });
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1][0]).toContain("INSERT INTO users");
  });

  it("creates a public account when neither username nor name matches", async () => {
    query
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({ recordset: [{ name: "Jane Smith" }] });
    expect(
      await createUser(account, { preventDuplicateName: true }),
    ).toMatchObject({ success: true });
    expect(query.mock.calls[2][0]).toContain("INSERT INTO users");
  });

  it("checks username case insensitively and blocks duplicates for admins too", async () => {
    query.mockResolvedValueOnce({ recordset: [{ id: "existing" }] });
    expect(await createUser(account)).toMatchObject({
      success: false,
      status: 409,
    });
    expect(query.mock.calls[0][0]).toContain(
      "LOWER(username) = LOWER(@username)",
    );
    expect(hash).not.toHaveBeenCalled();
  });

  it("returns conflict when a concurrent signup reserves the username first", async () => {
    const duplicate = new Error("This username is already in use");
    duplicate.name = "DuplicateUsernameError";
    query.mockResolvedValueOnce({ recordset: [] }).mockRejectedValueOnce(duplicate);
    expect(await createUser(account)).toMatchObject({ success: false, status: 409, code: "DUPLICATE_ACCOUNT" });
  });
});
