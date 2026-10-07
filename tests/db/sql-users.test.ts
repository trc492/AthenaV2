import { describe, expect, it, vi } from "vitest";
import { sqlUsers } from "@/db/sql-users";
import { MariaDbDatabaseService } from "@/db/mariadb-database-service";

const account = {
  id: "user-1",
  name: "Scout",
  username: "scout",
  passwordHash: "hash",
  role: "scout",
};

describe.each(["mariadb", "azuresql"] as const)(
  "%s user persistence",
  (dialect) => {
    it("uses the provider timestamp syntax for creation and status transitions", async () => {
      const query = vi.fn().mockResolvedValue({ recordset: [] });
      const users = sqlUsers(query, dialect);
      await users.create(account);
      await users.setActive(account.id, false);
      await users.setActive(account.id, true);
      const now = dialect === "mariadb" ? "NOW()" : "GETDATE()";
      expect(query.mock.calls[0][0]).toContain(now);
      expect(query.mock.calls[0][1]).toEqual(account);
      expect(query.mock.calls[1][0]).toContain(`deactivatedAt = ${now}`);
      expect(query.mock.calls[1][0]).toContain(
        "sessionVersion = sessionVersion + 1",
      );
      expect(query.mock.calls[2][0]).toContain("deactivatedAt IS NOT NULL");
    });

    it("keeps sensitive fields out of lists and includes inactive accounts only on request", async () => {
      const query = vi.fn().mockResolvedValue({ recordset: [] });
      const users = sqlUsers(query, dialect);
      await users.list();
      expect(query.mock.calls[0][0]).toContain("WHERE deactivatedAt IS NULL");
      expect(query.mock.calls[0][0]).not.toContain("password_hash");
      expect(query.mock.calls[0][0]).not.toContain("avatarData");
      await users.list(true);
      expect(query.mock.calls[1][0]).not.toContain(
        "WHERE deactivatedAt IS NULL",
      );
    });

    it("parameterizes user IDs and skips empty ID lists", async () => {
      const query = vi.fn().mockResolvedValue({ recordset: [] });
      const users = sqlUsers(query, dialect);
      expect(await users.getByIds([])).toEqual([]);
      expect(query).not.toHaveBeenCalled();
      const maliciousId = "x'); DROP TABLE users; --";
      await users.getByIds([maliciousId, maliciousId], true);
      expect(query.mock.calls[0][0]).not.toContain(maliciousId);
      expect(query.mock.calls[0][1]).toEqual({ id0: maliciousId });
      expect(query.mock.calls[0][0]).toContain("AND deactivatedAt IS NULL");
    });
  },
);

describe("MariaDB user-store wiring", () => {
  it("passes account values as positional parameters through the real service", async () => {
    const service = new MariaDbDatabaseService({});
    const execute = vi.fn().mockResolvedValue([[]]);
    vi.spyOn(service, "getPool").mockResolvedValue({
      execute,
    } as unknown as Awaited<ReturnType<typeof service.getPool>>);
    await service.users.create(account);
    expect(execute.mock.calls[0][0]).toContain("NOW()");
    expect(execute.mock.calls[0][0]).not.toContain("@username");
    expect(execute.mock.calls[0][1]).toEqual([
      account.id,
      account.name,
      account.username,
      account.passwordHash,
      account.role,
    ]);
  });
});
