import type { DatabaseService, GuestLinkRecord } from "@/lib/types";

type Query = NonNullable<DatabaseService["query"]>;
type Row = { data: string; revokedAt: number | string | null };
function record(row: Row): GuestLinkRecord {
  return {
    ...JSON.parse(row.data),
    revokedAt: row.revokedAt === null ? null : Number(row.revokedAt),
  };
}

export function sqlGuestLinks(query: Query) {
  return {
    async addGuestLink(link: GuestLinkRecord) {
      await query(
        "INSERT INTO guestLinks (id, data, revokedAt) VALUES (@id, @data, @revokedAt)",
        {
          id: link.id,
          data: JSON.stringify(link),
          revokedAt: link.revokedAt,
        },
      );
    },
    async getGuestLinks() {
      const result = await query<Row>("SELECT data, revokedAt FROM guestLinks");
      return result.recordset.map(record);
    },
    async getGuestLink(id: string) {
      const result = await query<Row>(
        "SELECT data, revokedAt FROM guestLinks WHERE id = @id",
        { id },
      );
      return result.recordset[0] ? record(result.recordset[0]) : undefined;
    },
    async updateGuestLinkAccess(id: string, access: { canAddScouting: boolean; canViewNotes: boolean }) {
      const result = await query<Row>("SELECT data, revokedAt FROM guestLinks WHERE id = @id", { id });
      const row = result.recordset[0];
      if (!row || row.revokedAt !== null) return;
      await query("UPDATE guestLinks SET data = @data WHERE id = @id AND revokedAt IS NULL", {
        id, data: JSON.stringify({ ...record(row), ...access }),
      });
    },
    async revokeGuestLink(id: string, revokedAt: number) {
      await query(
        "UPDATE guestLinks SET revokedAt = @revokedAt WHERE id = @id AND revokedAt IS NULL",
        { id, revokedAt },
      );
    },
  };
}
