import type {
  DatabaseService,
  UserStore,
  UserRecord,
  UserCredentials,
} from "@/lib/types";

type Query = NonNullable<DatabaseService["query"]>;
const profileColumns =
  "id, name, username, role, preferredPartners, avatarUrl, deactivatedAt, sessionVersion, created_at, updated_at";

/** Shared relational account operations; SQL and dialect choices stay in db. */
export function sqlUsers(
  query: Query,
  dialect: "mariadb" | "azuresql",
): UserStore {
  const now = dialect === "mariadb" ? "NOW()" : "GETDATE()";
  return {
    async list(includeInactive = false) {
      return (
        await query<UserRecord>(
          `SELECT ${profileColumns} FROM users ${includeInactive ? "" : "WHERE deactivatedAt IS NULL"} ORDER BY name ASC`,
        )
      ).recordset;
    },
    async getById(id) {
      return (
        await query<UserCredentials>(
          `SELECT ${profileColumns}, password_hash FROM users WHERE id = @id`,
          { id },
        )
      ).recordset[0];
    },
    async getByUsername(username) {
      return (
        await query<UserCredentials>(
          `SELECT ${profileColumns}, password_hash FROM users WHERE LOWER(username) = LOWER(@username)`,
          { username },
        )
      ).recordset[0];
    },
    async getByIds(ids, activeOnly = false) {
      if (!ids.length) return [];
      const uniqueIds = [...new Set(ids)];
      const params = Object.fromEntries(
        uniqueIds.map((id, i) => [`id${i}`, id]),
      );
      const placeholders = uniqueIds.map((_, i) => `@id${i}`).join(", ");
      return (
        await query<UserRecord>(
          `SELECT ${profileColumns} FROM users WHERE id IN (${placeholders}) ${activeOnly ? "AND deactivatedAt IS NULL" : ""}`,
          params,
        )
      ).recordset;
    },
    async hasAdmin() {
      const result = await query<{ count: number }>(
        "SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND deactivatedAt IS NULL",
      );
      return Number(result.recordset[0]?.count ?? 0) > 0;
    },
    async create(user) {
      await query(
        `INSERT INTO users (id, name, username, password_hash, role, created_at, updated_at)
        VALUES (@id, @name, @username, @passwordHash, @role, ${now}, ${now})`,
        user,
      );
    },
    async setActive(id, active) {
      await query(
        `UPDATE users SET deactivatedAt = ${active ? "NULL" : now},
        sessionVersion = sessionVersion + 1, updated_at = ${now}
        WHERE id = @id AND deactivatedAt IS ${active ? "NOT NULL" : "NULL"}`,
        { id },
      );
    },
    async getAvatar(id) {
      return (
        await query<{
          avatarData: Buffer | null;
          avatarMimeType: string | null;
        }>("SELECT avatarData, avatarMimeType FROM users WHERE id = @id", {
          id,
        })
      ).recordset[0];
    },
    async getSubscriptions(id) {
      return (
        await query<{ id: string; push_subscriptions: string | null }>(
          `SELECT id, push_subscriptions FROM users WHERE deactivatedAt IS NULL AND push_subscriptions IS NOT NULL ${id === undefined ? "" : "AND id = @id"}`,
          id === undefined ? undefined : { id },
        )
      ).recordset;
    },
  };
}
