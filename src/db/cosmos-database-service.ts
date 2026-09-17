import { DatabaseService } from "@/lib/types";
import type { PitEntry, MatchEntry, CustomEvent } from "@/lib/types";
import type { CompetitionType } from "@/lib/types";

// Minimal Azure Cosmos DB-backed service using @azure/cosmos
export class CosmosDatabaseService implements DatabaseService {
  private client: any;
  private container: any;

  constructor(
    private config?: {
      endpoint?: string;
      key?: string;
      databaseId?: string;
      containerId?: string;
    },
  ) {
    try {
      // dynamic import to avoid hard dependency when not used
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { CosmosClient } = require("@azure/cosmos");
      if (!config || !config.endpoint || !config.key) {
        // allow lazy initialization; throw on operations
        this.client = null;
        this.container = null;
      } else {
        this.client = new CosmosClient({
          endpoint: config.endpoint,
          key: config.key,
        });
      }
    } catch (err) {
      this.client = null;
      this.container = null;
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        "CosmosDatabaseService: @azure/cosmos not available",
        message,
      );
    }
  }

  private ensure() {
    if (!this.client) throw new Error("Cosmos client not initialized");
  }

  async addPitEntry(entry: Omit<PitEntry, "id">): Promise<number> {
    this.ensure();
    const db = this.client.database(this.config!.databaseId || "athena");
    const container = db.container(this.config!.containerId || "pitEntries");
    const numericId = Date.now();
    await container.items.create({
      ...entry,
      numericId,
      createdAt: new Date(),
    });
    return numericId;
  }

  async getPitEntry(
    teamNumber: number,
    year: number,
    competitionType?: CompetitionType,
  ): Promise<PitEntry | undefined> {
    this.ensure();
    const db = this.client.database(this.config!.databaseId || "athena");
    const container = db.container(this.config!.containerId || "pitEntries");
    const query = {
      query: "SELECT * FROM c WHERE c.teamNumber=@teamNumber AND c.year=@year",
      parameters: [
        { name: "@teamNumber", value: teamNumber },
        { name: "@year", value: year },
      ],
    };
    const { resources } = await container.items.query(query).fetchAll();
    if (!resources || resources.length === 0) return undefined;
    return resources[0] as PitEntry;
  }

  async getAllPitEntries(
    year?: number,
    eventCode?: string,
    competitionType?: CompetitionType,
  ): Promise<PitEntry[]> {
    this.ensure();
    const db = this.client.database(this.config!.databaseId || "athena");
    const container = db.container(this.config!.containerId || "pitEntries");
    let q = "SELECT * FROM c";
    const params: any[] = [];
    const where: string[] = [];
    if (year !== undefined) {
      where.push("c.year=@year");
      params.push({ name: "@year", value: year });
    }
    if (eventCode !== undefined) {
      where.push("c.eventCode=@eventCode");
      params.push({ name: "@eventCode", value: eventCode });
    }
    if (competitionType !== undefined) {
      where.push("c.competitionType=@competitionType");
      params.push({ name: "@competitionType", value: competitionType });
    }
    if (where.length) q += " WHERE " + where.join(" AND ");
    const { resources } = await container.items
      .query({ query: q, parameters: params })
      .fetchAll();
    return (resources || []) as PitEntry[];
  }

  async updatePitEntry(id: number, updates: Partial<PitEntry>): Promise<void> {
    this.ensure();
    const db = this.client.database(this.config!.databaseId || "athena");
    const container = db.container(this.config!.containerId || "pitEntries");
    const { resources } = await container.items
      .query({
        query: "SELECT * FROM c WHERE c.numericId=@id",
        parameters: [{ name: "@id", value: id }],
      })
      .fetchAll();
    if (!resources || resources.length === 0) return;
    for (const r of resources) {
      await container
        .item(r.id)
        .replace({ ...r, ...updates, updatedAt: new Date() });
    }
  }

  async deletePitEntry(id: number): Promise<void> {
    this.ensure();
    const db = this.client.database(this.config!.databaseId || "athena");
    const container = db.container(this.config!.containerId || "pitEntries");
    const { resources } = await container.items
      .query({
        query: "SELECT * FROM c WHERE c.numericId=@id",
        parameters: [{ name: "@id", value: id }],
      })
      .fetchAll();
    for (const r of resources) {
      try {
        await container.item(r.id).delete();
      } catch (e) {}
    }
  }

  async checkPitScoutExists(
    teamNumber: number,
    eventCode: string,
  ): Promise<boolean> {
    this.ensure();
    const db = this.client.database(this.config!.databaseId || "athena");
    const container = db.container(this.config!.containerId || "pitEntries");
    const { resources } = await container.items
      .query({
        query:
          "SELECT * FROM c WHERE c.teamNumber=@teamNumber AND c.eventCode=@eventCode",
        parameters: [
          { name: "@teamNumber", value: teamNumber },
          { name: "@eventCode", value: eventCode },
        ],
      })
      .fetchAll();
    return !!(resources && resources.length);
  }

  async addMatchEntry(entry: Omit<MatchEntry, "id">): Promise<number> {
    this.ensure();
    const db = this.client.database(this.config!.databaseId || "athena");
    const container = db.container(this.config!.containerId || "matchEntries");
    const numericId = Date.now();
    await container.items.create({
      ...entry,
      numericId,
      createdAt: new Date(),
    });
    return numericId;
  }
  async getMatchEntries(
    teamNumber: number,
    year?: number,
    competitionType?: CompetitionType,
  ): Promise<MatchEntry[]> {
    this.ensure();
    const db = this.client.database(this.config!.databaseId || "athena");
    const container = db.container(this.config!.containerId || "matchEntries");
    let q = "SELECT * FROM c WHERE c.teamNumber=@teamNumber";
    const params: any[] = [{ name: "@teamNumber", value: teamNumber }];
    if (year !== undefined) {
      q += " AND c.year=@year";
      params.push({ name: "@year", value: year });
    }
    if (competitionType !== undefined) {
      q += " AND c.competitionType=@competitionType";
      params.push({ name: "@competitionType", value: competitionType });
    }
    const { resources } = await container.items
      .query({ query: q, parameters: params })
      .fetchAll();
    return (resources || []) as MatchEntry[];
  }
  async getAllMatchEntries(
    year?: number,
    eventCode?: string,
    competitionType?: CompetitionType,
  ): Promise<MatchEntry[]> {
    this.ensure();
    const db = this.client.database(this.config!.databaseId || "athena");
    const container = db.container(this.config!.containerId || "matchEntries");
    let q = "SELECT * FROM c";
    const where: string[] = [];
    const params: any[] = [];
    if (year !== undefined) {
      where.push("c.year=@year");
      params.push({ name: "@year", value: year });
    }
    if (eventCode !== undefined) {
      where.push("c.eventCode=@eventCode");
      params.push({ name: "@eventCode", value: eventCode });
    }
    if (competitionType !== undefined) {
      where.push("c.competitionType=@competitionType");
      params.push({ name: "@competitionType", value: competitionType });
    }
    if (where.length) q += " WHERE " + where.join(" AND ");
    const { resources } = await container.items
      .query({ query: q, parameters: params })
      .fetchAll();
    return (resources || []) as MatchEntry[];
  }
  async updateMatchEntry(
    id: number,
    updates: Partial<MatchEntry>,
  ): Promise<void> {
    this.ensure();
    const db = this.client.database(this.config!.databaseId || "athena");
    const container = db.container(this.config!.containerId || "matchEntries");
    const { resources } = await container.items
      .query({
        query: "SELECT * FROM c WHERE c.numericId=@id",
        parameters: [{ name: "@id", value: id }],
      })
      .fetchAll();
    if (!resources || resources.length === 0) return;
    for (const r of resources) {
      await container
        .item(r.id)
        .replace({ ...r, ...updates, updatedAt: new Date() });
    }
  }
  async deleteMatchEntry(id: number): Promise<void> {
    this.ensure();
    const db = this.client.database(this.config!.databaseId || "athena");
    const container = db.container(this.config!.containerId || "matchEntries");
    const { resources } = await container.items
      .query({
        query: "SELECT * FROM c WHERE c.numericId=@id",
        parameters: [{ name: "@id", value: id }],
      })
      .fetchAll();
    for (const r of resources) {
      try {
        await container.item(r.id).delete();
      } catch (e) {}
    }
  }
  async checkMatchScoutExists(
    teamNumber: number,
    matchNumber: number,
    eventCode: string,
  ): Promise<boolean> {
    this.ensure();
    const db = this.client.database(this.config!.databaseId || "athena");
    const container = db.container(this.config!.containerId || "matchEntries");
    const { resources } = await container.items
      .query({
        query:
          "SELECT * FROM c WHERE c.teamNumber=@teamNumber AND c.matchNumber=@matchNumber AND c.eventCode=@eventCode",
        parameters: [
          { name: "@teamNumber", value: teamNumber },
          { name: "@matchNumber", value: matchNumber },
          { name: "@eventCode", value: eventCode },
        ],
      })
      .fetchAll();
    return !!(resources && resources.length);
  }

  async addCustomEvent(event: Omit<CustomEvent, "id">): Promise<number> {
    this.ensure();
    const db = this.client.database(this.config!.databaseId || "athena");
    const container = db.container(this.config!.containerId || "customEvents");
    const numericId = Date.now();
    await container.items.create({
      ...event,
      numericId,
      createdAt: new Date(),
    });
    return numericId;
  }

  async getCustomEvent(
    eventCode: string,
    competitionType?: CompetitionType,
  ): Promise<CustomEvent | undefined> {
    this.ensure();
    const db = this.client.database(this.config!.databaseId || "athena");
    const container = db.container(this.config!.containerId || "customEvents");
    let q = "SELECT * FROM c WHERE c.eventCode=@eventCode";
    const params: any[] = [{ name: "@eventCode", value: eventCode }];
    if (competitionType) {
      q += " AND c.competitionType=@competitionType";
      params.push({ name: "@competitionType", value: competitionType });
    }
    const { resources } = await container.items
      .query({ query: q, parameters: params })
      .fetchAll();
    if (!resources || resources.length === 0) return undefined;
    return resources[0] as CustomEvent;
  }

  async getAllCustomEvents(
    year?: number,
    competitionType?: CompetitionType,
  ): Promise<CustomEvent[]> {
    this.ensure();
    const db = this.client.database(this.config!.databaseId || "athena");
    const container = db.container(this.config!.containerId || "customEvents");
    let q = "SELECT * FROM c";
    const where: string[] = [];
    const params: any[] = [];
    if (year !== undefined) {
      where.push("c.year=@year");
      params.push({ name: "@year", value: year });
    }
    if (competitionType !== undefined) {
      where.push("c.competitionType=@competitionType");
      params.push({ name: "@competitionType", value: competitionType });
    }
    if (where.length) q += " WHERE " + where.join(" AND ");
    const { resources } = await container.items
      .query({ query: q, parameters: params })
      .fetchAll();
    return (resources || []) as CustomEvent[];
  }

  async updateCustomEvent(
    eventCode: string,
    updates: Partial<CustomEvent>,
  ): Promise<void> {
    this.ensure();
    const db = this.client.database(this.config!.databaseId || "athena");
    const container = db.container(this.config!.containerId || "customEvents");
    const { resources } = await container.items
      .query({
        query: "SELECT * FROM c WHERE c.eventCode=@eventCode",
        parameters: [{ name: "@eventCode", value: eventCode }],
      })
      .fetchAll();
    if (!resources || resources.length === 0) return;
    for (const r of resources) {
      const id = r.id;
      await container
        .item(id)
        .replace({ ...r, ...updates, updatedAt: new Date() });
    }
  }

  async deleteCustomEvent(eventCode: string): Promise<void> {
    this.ensure();
    const db = this.client.database(this.config!.databaseId || "athena");
    const container = db.container(this.config!.containerId || "customEvents");
    const { resources } = await container.items
      .query({
        query: "SELECT * FROM c WHERE c.eventCode=@eventCode",
        parameters: [{ name: "@eventCode", value: eventCode }],
      })
      .fetchAll();
    for (const r of resources) {
      try {
        await container.item(r.id).delete();
      } catch (e) {
        /* best-effort */
      }
    }
  }

  async updateUserPreferredPartners(
    userId: string,
    preferredPartners: string[],
  ): Promise<void> {
    this.ensure();
    const db = this.client.database(this.config!.databaseId || "athena");
    const container = db.container(this.config!.containerId || "users");
    await container.items.upsert({ id: userId, preferredPartners });
  }

  async getUserPreferredPartners(userId: string): Promise<string[]> {
    this.ensure();
    const db = this.client.database(this.config!.databaseId || "athena");
    const container = db.container(this.config!.containerId || "users");
    try {
      const { resource } = await container.item(userId).read();
      return resource?.preferredPartners || [];
    } catch (e) {
      return [];
    }
  }

  async addPicklist(picklist: any): Promise<number> {
    this.ensure();
    const db = this.client.database(this.config!.databaseId || "athena");
    const container = db.container(this.config!.containerId || "picklists");
    const numericId = Date.now();
    await container.items.create({
      ...picklist,
      numericId,
      created_at: new Date(),
    });
    return numericId;
  }

  async getPicklist(id: number): Promise<any | undefined> {
    this.ensure();
    const db = this.client.database(this.config!.databaseId || "athena");
    const container = db.container(this.config!.containerId || "picklists");
    const { resources } = await container.items
      .query({
        query: "SELECT * FROM c WHERE c.numericId=@id",
        parameters: [{ name: "@id", value: id }],
      })
      .fetchAll();
    return (resources && resources[0]) || undefined;
  }

  async getPicklistByEvent(
    eventCode: string,
    year: number,
    competitionType: string,
    picklistType?: string,
  ): Promise<any | undefined> {
    this.ensure();
    const db = this.client.database(this.config!.databaseId || "athena");
    const container = db.container(this.config!.containerId || "picklists");
    let q =
      "SELECT * FROM c WHERE c.eventCode=@eventCode AND c.year=@year AND c.competitionType=@competitionType";
    const params: any[] = [
      { name: "@eventCode", value: eventCode },
      { name: "@year", value: year },
      { name: "@competitionType", value: competitionType },
    ];
    if (picklistType) {
      q += " AND c.picklistType=@picklistType";
      params.push({ name: "@picklistType", value: picklistType });
    }
    const { resources } = await container.items
      .query({ query: q, parameters: params })
      .fetchAll();
    return (resources && resources[0]) || undefined;
  }

  async getPicklistsByEvent(
    eventCode: string,
    year: number,
    competitionType: string,
  ): Promise<any[]> {
    this.ensure();
    const db = this.client.database(this.config!.databaseId || "athena");
    const container = db.container(this.config!.containerId || "picklists");
    const { resources } = await container.items
      .query({
        query:
          "SELECT * FROM c WHERE c.eventCode=@eventCode AND c.year=@year AND c.competitionType=@competitionType",
        parameters: [
          { name: "@eventCode", value: eventCode },
          { name: "@year", value: year },
          { name: "@competitionType", value: competitionType },
        ],
      })
      .fetchAll();
    return resources || [];
  }

  async updatePicklist(id: number, updates: Partial<any>): Promise<void> {
    this.ensure();
    const db = this.client.database(this.config!.databaseId || "athena");
    const container = db.container(this.config!.containerId || "picklists");
    const { resources } = await container.items
      .query({
        query: "SELECT * FROM c WHERE c.numericId=@id",
        parameters: [{ name: "@id", value: id }],
      })
      .fetchAll();
    if (!resources || resources.length === 0) return;
    for (const r of resources) {
      await container
        .item(r.id)
        .replace({ ...r, ...updates, updated_at: new Date() });
    }
  }

  async deletePicklist(id: number): Promise<void> {
    this.ensure();
    const db = this.client.database(this.config!.databaseId || "athena");
    const container = db.container(this.config!.containerId || "picklists");
    const { resources } = await container.items
      .query({
        query: "SELECT * FROM c WHERE c.numericId=@id",
        parameters: [{ name: "@id", value: id }],
      })
      .fetchAll();
    for (const r of resources) {
      try {
        await container.item(r.id).delete();
      } catch (e) {}
    }
  }

  async addPicklistEntry(entry: any): Promise<number> {
    this.ensure();
    const db = this.client.database(this.config!.databaseId || "athena");
    const container = db.container(
      this.config!.containerId || "picklistEntries",
    );
    const numericId = Date.now();
    await container.items.create({
      ...entry,
      numericId,
      created_at: new Date(),
    });
    return numericId;
  }

  async getPicklistEntry(id: number): Promise<any | undefined> {
    this.ensure();
    const db = this.client.database(this.config!.databaseId || "athena");
    const container = db.container(
      this.config!.containerId || "picklistEntries",
    );
    const { resources } = await container.items
      .query({
        query: "SELECT * FROM c WHERE c.numericId=@id",
        parameters: [{ name: "@id", value: id }],
      })
      .fetchAll();
    return (resources && resources[0]) || undefined;
  }

  async getPicklistEntries(picklistId: number): Promise<any[]> {
    this.ensure();
    const db = this.client.database(this.config!.databaseId || "athena");
    const container = db.container(
      this.config!.containerId || "picklistEntries",
    );
    const { resources } = await container.items
      .query({
        query:
          "SELECT * FROM c WHERE c.picklistId=@picklistId ORDER BY c.rank ASC",
        parameters: [{ name: "@picklistId", value: picklistId }],
      })
      .fetchAll();
    return resources || [];
  }

  async updatePicklistEntry(id: number, updates: Partial<any>): Promise<void> {
    this.ensure();
    const db = this.client.database(this.config!.databaseId || "athena");
    const container = db.container(
      this.config!.containerId || "picklistEntries",
    );
    const { resources } = await container.items
      .query({
        query: "SELECT * FROM c WHERE c.numericId=@id",
        parameters: [{ name: "@id", value: id }],
      })
      .fetchAll();
    if (!resources || resources.length === 0) return;
    for (const r of resources) {
      await container
        .item(r.id)
        .replace({ ...r, ...updates, updated_at: new Date() });
    }
  }

  async deletePicklistEntry(id: number): Promise<void> {
    this.ensure();
    const db = this.client.database(this.config!.databaseId || "athena");
    const container = db.container(
      this.config!.containerId || "picklistEntries",
    );
    const { resources } = await container.items
      .query({
        query: "SELECT * FROM c WHERE c.numericId=@id",
        parameters: [{ name: "@id", value: id }],
      })
      .fetchAll();
    for (const r of resources) {
      try {
        await container.item(r.id).delete();
      } catch (e) {}
    }
  }

  async updatePicklistEntryRank(
    picklistId: number,
    teamNumber: number,
    rank: number,
  ): Promise<void> {
    this.ensure();
    const db = this.client.database(this.config!.databaseId || "athena");
    const container = db.container(
      this.config!.containerId || "picklistEntries",
    );
    const { resources } = await container.items
      .query({
        query:
          "SELECT * FROM c WHERE c.picklistId=@picklistId AND c.teamNumber=@teamNumber",
        parameters: [
          { name: "@picklistId", value: picklistId },
          { name: "@teamNumber", value: teamNumber },
        ],
      })
      .fetchAll();
    if (!resources || resources.length === 0) return;
    for (const r of resources) {
      await container
        .item(r.id)
        .replace({ ...r, rank, updated_at: new Date() });
    }
  }

  async reorderPicklistEntries(
    picklistId: number,
    entries: Array<{ teamNumber: number; rank: number }>,
  ): Promise<void> {
    for (const e of entries) {
      await this.updatePicklistEntryRank(picklistId, e.teamNumber, e.rank);
    }
  }

  async addPicklistNote(note: any): Promise<number> {
    this.ensure();
    const db = this.client.database(this.config!.databaseId || "athena");
    const container = db.container(this.config!.containerId || "picklistNotes");
    const numericId = Date.now();
    await container.items.create({
      ...note,
      numericId,
      created_at: new Date(),
    });
    return numericId;
  }
  async getPicklistNote(id: number): Promise<any | undefined> {
    this.ensure();
    const db = this.client.database(this.config!.databaseId || "athena");
    const container = db.container(this.config!.containerId || "picklistNotes");
    const { resources } = await container.items
      .query({
        query: "SELECT * FROM c WHERE c.numericId=@id",
        parameters: [{ name: "@id", value: id }],
      })
      .fetchAll();
    return (resources && resources[0]) || undefined;
  }
  async getPicklistNotes(
    picklistId: number,
    teamNumber?: number,
  ): Promise<any[]> {
    this.ensure();
    const db = this.client.database(this.config!.databaseId || "athena");
    const container = db.container(this.config!.containerId || "picklistNotes");
    let q = "SELECT * FROM c WHERE c.picklistId=@picklistId";
    const params: any[] = [{ name: "@picklistId", value: picklistId }];
    if (teamNumber !== undefined) {
      q += " AND c.teamNumber=@teamNumber";
      params.push({ name: "@teamNumber", value: teamNumber });
    }
    const { resources } = await container.items
      .query({ query: q, parameters: params })
      .fetchAll();
    return resources || [];
  }
  async updatePicklistNote(id: number, updates: Partial<any>): Promise<void> {
    this.ensure();
    const db = this.client.database(this.config!.databaseId || "athena");
    const container = db.container(this.config!.containerId || "picklistNotes");
    const { resources } = await container.items
      .query({
        query: "SELECT * FROM c WHERE c.numericId=@id",
        parameters: [{ name: "@id", value: id }],
      })
      .fetchAll();
    if (!resources || resources.length === 0) return;
    for (const r of resources) {
      await container
        .item(r.id)
        .replace({ ...r, ...updates, updated_at: new Date() });
    }
  }
  async deletePicklistNote(id: number): Promise<void> {
    this.ensure();
    const db = this.client.database(this.config!.databaseId || "athena");
    const container = db.container(this.config!.containerId || "picklistNotes");
    const { resources } = await container.items
      .query({
        query: "SELECT * FROM c WHERE c.numericId=@id",
        parameters: [{ name: "@id", value: id }],
      })
      .fetchAll();
    for (const r of resources) {
      try {
        await container.item(r.id).delete();
      } catch (e) {}
    }
  }

  async exportData(): Promise<{
    pitEntries: PitEntry[];
    matchEntries: MatchEntry[];
  }> {
    this.ensure();
    const db = this.client.database(this.config!.databaseId || "athena");
    const pitContainer = db.container(this.config!.containerId || "pitEntries");
    const matchContainer = db.container(
      this.config!.containerId || "matchEntries",
    );
    const pitRes = await pitContainer.items
      .query({ query: "SELECT * FROM c" })
      .fetchAll();
    const matchRes = await matchContainer.items
      .query({ query: "SELECT * FROM c" })
      .fetchAll();
    return {
      pitEntries: (pitRes.resources || []) as PitEntry[],
      matchEntries: (matchRes.resources || []) as MatchEntry[],
    };
  }

  async importData(data: {
    pitEntries?: PitEntry[];
    matchEntries?: MatchEntry[];
  }): Promise<void> {
    this.ensure();
    const db = this.client.database(this.config!.databaseId || "athena");
    const pitEntries = data.pitEntries || [];
    const matchEntries = data.matchEntries || [];
    if (pitEntries.length > 0) {
      const pitContainer = db.container(this.config!.containerId || "pitEntries");
      for (const p of pitEntries) {
        await pitContainer.items.create(p);
      }
    }
    if (matchEntries.length > 0) {
      const matchContainer = db.container(
        this.config!.containerId || "matchEntries",
      );
      for (const m of matchEntries) {
        await matchContainer.items.create(m);
      }
    }
  }

  async resetDatabase(): Promise<void> {
    this.ensure();
    const db = this.client.database(this.config!.databaseId || "athena");
    const containers = [
      "pitEntries",
      "matchEntries",
      "picklists",
      "picklistEntries",
      "picklistNotes",
      "customEvents",
      "users",
    ];
    for (const name of containers) {
      const container = db.container(this.config!.containerId || name);
      const { resources } = await container.items
        .query({ query: "SELECT * FROM c" })
        .fetchAll();
      for (const r of resources) {
        try {
          await container.item(r.id).delete();
        } catch (e) {}
      }
    }
  }

  /**
   * Cosmos DB does not have a relational users table — user records are managed
   * via Azure AD / the SDK layer. This stub satisfies the DatabaseService
   * interface; throw if called so misconfiguration is caught at runtime.
   */
  async updateUser(_id: string, _updates: import("@/lib/types").UserUpdates): Promise<void> {
    throw new Error("updateUser is not supported by the Cosmos DB provider. Use Azure AD or a relational provider for user management.");
  }
}

export default CosmosDatabaseService;
