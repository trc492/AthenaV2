import {
  DatabaseService,
  PitEntry,
  MatchEntry,
  CustomEvent,
  CompetitionType,
  Picklist,
  PicklistEntry,
  PicklistNote,
} from "@/lib/types";

import type { Pool } from "mysql2/promise";

export class MariaDbDatabaseService implements DatabaseService {
  private pool: Pool | null = null;
  private config: { connectionString?: string; host?: string; port?: number; database?: string; user?: string; password?: string };

  constructor(config: { connectionString?: string; host?: string; port?: number; database?: string; user?: string; password?: string }) {
    this.config = config;
  }

  public async getPool(): Promise<Pool> {
    if (this.pool) return this.pool;
    const mysql = await import("mysql2/promise");
    if (this.config.connectionString) {
      this.pool = mysql.createPool(this.config.connectionString as any);
    } else {
      this.pool = mysql.createPool({
        host: this.config.host || "localhost",
        port: this.config.port || 3306,
        user: this.config.user,
        password: this.config.password,
        database: this.config.database,
        connectionLimit: 10,
        namedPlaceholders: false,
      });
    }

    await this.initializeTables();
    return this.pool;
  }

  public async query<T = unknown>(
    sql: string,
    params: Record<string, unknown> = {},
  ): Promise<{ recordset: T[] }> {
    const pool = await this.getPool();
    const translatedSql = sql.replace(/GETDATE\(\)/gi, "CURRENT_TIMESTAMP");
    const { sql: normalizedSql, values } = this.normalizeSqlParams(
      translatedSql,
      params,
    );
    const [rows]: any = await pool.execute(normalizedSql, values as any);
    return { recordset: rows as T[] };
  }

  private normalizeSqlParams(
    sql: string,
    params: Record<string, unknown>,
  ): { sql: string; values: any[] } {
    const values: any[] = [];
    const normalizedSql = sql.replace(/@([A-Za-z_][A-Za-z0-9_]*)/g, (_match, name: string) => {
      if (!Object.prototype.hasOwnProperty.call(params, name)) {
        throw new Error(`Missing SQL parameter: ${name}`);
      }

      values.push(params[name]);
      return "?";
    });

    return { sql: normalizedSql, values };
  }

  private async initializeTables(): Promise<void> {
    const pool = await this.getPool();

    // users
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255),
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'scout',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        preferredPartners LONGTEXT,
        avatarUrl VARCHAR(1024),
        avatarData LONGBLOB,
        avatarMimeType VARCHAR(100)
      ) ENGINE=InnoDB;
    `);

    // pitEntries
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pitEntries (
        id INT PRIMARY KEY AUTO_INCREMENT,
        teamNumber INT NOT NULL,
        year INT NOT NULL,
        competitionType VARCHAR(10) DEFAULT 'FRC' NOT NULL,
        driveTrain VARCHAR(50) NOT NULL,
        weight DECIMAL(10,2) NOT NULL,
        length DECIMAL(10,2) NOT NULL,
        width DECIMAL(10,2) NOT NULL,
        eventName VARCHAR(255),
        eventCode VARCHAR(50),
        userId VARCHAR(255),
        gameSpecificData LONGTEXT,
        autoDrawing LONGTEXT,
        notes LONGTEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT uq_pit_entry UNIQUE (teamNumber, eventCode, year, competitionType),
        INDEX idx_pit_team (teamNumber),
        INDEX idx_pit_event (eventCode)
      ) ENGINE=InnoDB;
    `);

    // matchEntries
    await pool.query(`
      CREATE TABLE IF NOT EXISTS matchEntries (
        id INT PRIMARY KEY AUTO_INCREMENT,
        matchNumber INT NOT NULL,
        teamNumber INT NOT NULL,
        year INT NOT NULL,
        competitionType VARCHAR(10) DEFAULT 'FRC' NOT NULL,
        alliance VARCHAR(10) NOT NULL,
        alliancePosition INT,
        eventName VARCHAR(255),
        eventCode VARCHAR(50),
        userId VARCHAR(255),
        gameSpecificData LONGTEXT,
        notes LONGTEXT,
        timestamp DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT uq_match_entry UNIQUE (teamNumber, matchNumber, eventCode, year, competitionType),
        INDEX idx_match_team (teamNumber),
        INDEX idx_match_event (eventCode)
      ) ENGINE=InnoDB;
    `);

    // customEvents
    await pool.query(`
      CREATE TABLE IF NOT EXISTS customEvents (
        id INT PRIMARY KEY AUTO_INCREMENT,
        eventCode VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        endDate DATE,
        matchCount INT NOT NULL DEFAULT 0,
        location VARCHAR(255),
        region VARCHAR(100),
        year INT NOT NULL,
        competitionType VARCHAR(10) DEFAULT 'FRC' NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // matchAssignments
    await pool.query(`
      CREATE TABLE IF NOT EXISTS matchAssignments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        eventCode VARCHAR(50) NOT NULL,
        year INT NOT NULL,
        matchNumber INT NOT NULL,
        alliance VARCHAR(10) NOT NULL,
        position INT NOT NULL,
        userId VARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_match_assignment UNIQUE (eventCode, year, matchNumber, alliance, position)
      ) ENGINE=InnoDB;
    `);

    // picklists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS picklists (
        id INT PRIMARY KEY AUTO_INCREMENT,
        eventCode VARCHAR(50) NOT NULL,
        year INT NOT NULL,
        competitionType VARCHAR(10) DEFAULT 'FRC' NOT NULL,
        picklistType VARCHAR(20) DEFAULT 'main' NOT NULL,
        name VARCHAR(255),
        createdBy VARCHAR(255),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT uq_picklist UNIQUE (eventCode, year, competitionType, picklistType)
      ) ENGINE=InnoDB;
    `);

    // picklistEntries
    await pool.query(`
      CREATE TABLE IF NOT EXISTS picklistEntries (
        id INT PRIMARY KEY AUTO_INCREMENT,
        picklistId INT NOT NULL,
        teamNumber INT NOT NULL,
        rank INT NOT NULL,
        source VARCHAR(50),
        notes LONGTEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT uq_picklist_team UNIQUE (picklistId, teamNumber),
        INDEX idx_picklist_entries (picklistId),
        FOREIGN KEY (picklistId) REFERENCES picklists(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // picklistNotes
    await pool.query(`
      CREATE TABLE IF NOT EXISTS picklistNotes (
        id INT PRIMARY KEY AUTO_INCREMENT,
        picklistId INT NOT NULL,
        teamNumber INT NOT NULL,
        note LONGTEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (picklistId) REFERENCES picklists(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);
  }

  // Pit scouting methods
  async addPitEntry(entry: Omit<PitEntry, "id">): Promise<number> {
    const pool = await this.getPool();
    const q = `INSERT INTO pitEntries (teamNumber, year, competitionType, driveTrain, weight, length, width, eventName, eventCode, userId, gameSpecificData, autoDrawing, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    try {
      const [result]: any = await pool.execute({
        sql: q,
        values: [
          entry.teamNumber,
          entry.year,
          entry.competitionType,
          entry.driveTrain,
          entry.weight ?? null,
          entry.length ?? null,
          entry.width ?? null,
          entry.eventName ?? null,
          entry.eventCode ?? null,
          entry.userId ?? null,
          JSON.stringify(entry.gameSpecificData),
          entry.autoDrawing ?? null,
          entry.notes ?? null,
        ],
      });
      return result.insertId;
    } catch (error: any) {
      if (error?.code === "ER_DUP_ENTRY" || String(error.message).includes("uq_pit_entry")) {
        throw new Error(`Duplicate pit entry: Team ${entry.teamNumber} already has a pit scouting entry for this event`);
      }
      throw error;
    }
  }

  async getPitEntry(teamNumber: number, year: number, competitionType?: CompetitionType): Promise<PitEntry | undefined> {
    const pool = await this.getPool();
    let sql = `SELECT * FROM pitEntries WHERE teamNumber = ? AND year = ?`;
    const params: any[] = [teamNumber, year];
    if (competitionType) {
      sql += ` AND competitionType = ?`;
      params.push(competitionType);
    }
    const [rows]: any = await pool.execute(sql, params);
    if ((rows as any[]).length === 0) return undefined;
    const row = rows[0];
    return {
      id: row.id,
      teamNumber: row.teamNumber,
      year: row.year,
      competitionType: (row.competitionType || "FRC") as CompetitionType,
      driveTrain: row.driveTrain,
      weight: row.weight !== null ? row.weight : undefined,
      length: row.length !== null ? row.length : undefined,
      width: row.width !== null ? row.width : undefined,
      eventName: row.eventName || undefined,
      eventCode: row.eventCode || undefined,
      userId: row.userId || undefined,
      gameSpecificData: JSON.parse(row.gameSpecificData || "null"),
      autoDrawing: row.autoDrawing || undefined,
      notes: row.notes || undefined,
    } as PitEntry;
  }

  async getAllPitEntries(year?: number, eventCode?: string, competitionType?: CompetitionType): Promise<PitEntry[]> {
    const pool = await this.getPool();
    let sql = `SELECT * FROM pitEntries`;
    const conditions: string[] = [];
    const params: any[] = [];
    if (year !== undefined) {
      conditions.push(`year = ?`);
      params.push(year);
    }
    if (eventCode !== undefined) {
      conditions.push(`eventCode = ?`);
      params.push(eventCode);
    }
    if (competitionType !== undefined) {
      conditions.push(`competitionType = ?`);
      params.push(competitionType);
    }
    if (conditions.length > 0) sql += ` WHERE ` + conditions.join(" AND ");
    const [rows]: any = await pool.execute(sql, params);
    return (rows as any[]).map((row: any) => ({
      id: row.id,
      teamNumber: row.teamNumber,
      year: row.year,
      competitionType: (row.competitionType || "FRC") as CompetitionType,
      driveTrain: row.driveTrain,
      weight: row.weight !== null ? row.weight : undefined,
      length: row.length !== null ? row.length : undefined,
      width: row.width !== null ? row.width : undefined,
      eventName: row.eventName || undefined,
      eventCode: row.eventCode || undefined,
      userId: row.userId || undefined,
      gameSpecificData: JSON.parse(row.gameSpecificData || "null"),
      autoDrawing: row.autoDrawing || undefined,
      notes: row.notes || undefined,
    } as PitEntry));
  }

  async updatePitEntry(id: number, updates: Partial<PitEntry>): Promise<void> {
    const pool = await this.getPool();
    const setParts: string[] = [];
    const params: any[] = [];
    if (updates.teamNumber !== undefined) {
      setParts.push(`teamNumber = ?`);
      params.push(updates.teamNumber);
    }
    if (updates.year !== undefined) {
      setParts.push(`year = ?`);
      params.push(updates.year);
    }
    if (updates.driveTrain !== undefined) {
      setParts.push(`driveTrain = ?`);
      params.push(updates.driveTrain);
    }
    if (updates.weight !== undefined) {
      setParts.push(`weight = ?`);
      params.push(updates.weight);
    }
    if (updates.length !== undefined) {
      setParts.push(`length = ?`);
      params.push(updates.length);
    }
    if (updates.width !== undefined) {
      setParts.push(`width = ?`);
      params.push(updates.width);
    }
    if (updates.eventName !== undefined) {
      setParts.push(`eventName = ?`);
      params.push(updates.eventName);
    }
    if (updates.eventCode !== undefined) {
      setParts.push(`eventCode = ?`);
      params.push(updates.eventCode);
    }
    if (updates.gameSpecificData !== undefined) {
      setParts.push(`gameSpecificData = ?`);
      params.push(JSON.stringify(updates.gameSpecificData));
    }
    if (updates.notes !== undefined) {
      setParts.push(`notes = ?`);
      params.push(updates.notes);
    }

    if (setParts.length === 0) return;
    const sql = `UPDATE pitEntries SET ${setParts.join(", ")} WHERE id = ?`;
    params.push(id);
    await pool.execute(sql, params);
  }

  async deletePitEntry(id: number): Promise<void> {
    const pool = await this.getPool();
    await pool.execute(`DELETE FROM pitEntries WHERE id = ?`, [id]);
  }

  async checkPitScoutExists(teamNumber: number, eventCode: string): Promise<boolean> {
    const pool = await this.getPool();
    const [rows]: any = await pool.execute(`SELECT COUNT(*) as count FROM pitEntries WHERE teamNumber = ? AND eventCode = ?`, [teamNumber, eventCode]);
    return rows[0].count > 0;
  }

  // Match methods
  async addMatchEntry(entry: Omit<MatchEntry, "id">): Promise<number> {
    const pool = await this.getPool();
    const q = `INSERT INTO matchEntries (matchNumber, teamNumber, year, competitionType, alliance, alliancePosition, eventName, eventCode, userId, gameSpecificData, notes, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    try {
      const [result]: any = await pool.execute(q, [
        entry.matchNumber,
        entry.teamNumber,
        entry.year,
        entry.competitionType,
        entry.alliance,
        entry.alliancePosition ?? null,
        entry.eventName ?? null,
        entry.eventCode ?? null,
        entry.userId ?? null,
        JSON.stringify(entry.gameSpecificData),
        entry.notes ?? null,
        entry.timestamp,
      ]);
      return result.insertId;
    } catch (error: any) {
      if (error?.code === "ER_DUP_ENTRY" || String(error.message).includes("uq_match_entry")) {
        throw new Error(`Duplicate match entry: Team ${entry.teamNumber} already has an entry for match ${entry.matchNumber} at this event`);
      }
      throw error;
    }
  }

  async getMatchEntries(teamNumber: number, year?: number, competitionType?: CompetitionType): Promise<MatchEntry[]> {
    const pool = await this.getPool();
    let sql = `SELECT * FROM matchEntries WHERE teamNumber = ?`;
    const params: any[] = [teamNumber];
    if (year !== undefined) {
      sql += ` AND year = ?`;
      params.push(year);
    }
    if (competitionType !== undefined) {
      sql += ` AND competitionType = ?`;
      params.push(competitionType);
    }
    const [rows]: any = await pool.execute(sql, params);
    return (rows as any[]).map((row: any) => ({
      id: row.id,
      matchNumber: row.matchNumber,
      teamNumber: row.teamNumber,
      year: row.year,
      competitionType: (row.competitionType || "FRC") as CompetitionType,
      alliance: row.alliance,
      alliancePosition: row.alliancePosition || undefined,
      eventName: row.eventName || undefined,
      eventCode: row.eventCode || undefined,
      userId: row.userId || undefined,
      gameSpecificData: JSON.parse(row.gameSpecificData || "null"),
      notes: row.notes,
      timestamp: row.timestamp,
    } as MatchEntry));
  }

  async getAllMatchEntries(year?: number, eventCode?: string, competitionType?: CompetitionType): Promise<MatchEntry[]> {
    const pool = await this.getPool();
    let sql = `SELECT * FROM matchEntries`;
    const conditions: string[] = [];
    const params: any[] = [];
    if (year !== undefined) {
      conditions.push(`year = ?`);
      params.push(year);
    }
    if (eventCode !== undefined) {
      conditions.push(`eventCode = ?`);
      params.push(eventCode);
    }
    if (competitionType !== undefined) {
      conditions.push(`competitionType = ?`);
      params.push(competitionType);
    }
    if (conditions.length > 0) sql += ` WHERE ` + conditions.join(" AND ");
    const [rows]: any = await pool.execute(sql, params);
    return (rows as any[]).map((row: any) => ({
      id: row.id,
      matchNumber: row.matchNumber,
      teamNumber: row.teamNumber,
      year: row.year,
      competitionType: (row.competitionType || "FRC") as CompetitionType,
      alliance: row.alliance,
      alliancePosition: row.alliancePosition || undefined,
      eventName: row.eventName || undefined,
      eventCode: row.eventCode || undefined,
      userId: row.userId || undefined,
      gameSpecificData: JSON.parse(row.gameSpecificData || "null"),
      notes: row.notes,
      timestamp: row.timestamp,
    } as MatchEntry));
  }

  async updateMatchEntry(id: number, updates: Partial<MatchEntry>): Promise<void> {
    const pool = await this.getPool();
    const setParts: string[] = [];
    const params: any[] = [];
    if (updates.matchNumber !== undefined) {
      setParts.push(`matchNumber = ?`);
      params.push(updates.matchNumber);
    }
    if (updates.teamNumber !== undefined) {
      setParts.push(`teamNumber = ?`);
      params.push(updates.teamNumber);
    }
    if (updates.year !== undefined) {
      setParts.push(`year = ?`);
      params.push(updates.year);
    }
    if (updates.alliance !== undefined) {
      setParts.push(`alliance = ?`);
      params.push(updates.alliance);
    }
    if (updates.alliancePosition !== undefined) {
      setParts.push(`alliancePosition = ?`);
      params.push(updates.alliancePosition);
    }
    if (updates.eventName !== undefined) {
      setParts.push(`eventName = ?`);
      params.push(updates.eventName);
    }
    if (updates.eventCode !== undefined) {
      setParts.push(`eventCode = ?`);
      params.push(updates.eventCode);
    }
    if (updates.gameSpecificData !== undefined) {
      setParts.push(`gameSpecificData = ?`);
      params.push(JSON.stringify(updates.gameSpecificData));
    }
    if (updates.notes !== undefined) {
      setParts.push(`notes = ?`);
      params.push(updates.notes);
    }
    if (updates.timestamp !== undefined) {
      setParts.push(`timestamp = ?`);
      params.push(updates.timestamp);
    }

    if (setParts.length === 0) return;
    const sql = `UPDATE matchEntries SET ${setParts.join(", ")} WHERE id = ?`;
    params.push(id);
    await pool.execute(sql, params);
  }

  async deleteMatchEntry(id: number): Promise<void> {
    const pool = await this.getPool();
    await pool.execute(`DELETE FROM matchEntries WHERE id = ?`, [id]);
  }

  async checkMatchScoutExists(teamNumber: number, matchNumber: number, eventCode: string): Promise<boolean> {
    const pool = await this.getPool();
    const [rows]: any = await pool.execute(`SELECT COUNT(*) as count FROM matchEntries WHERE teamNumber = ? AND matchNumber = ? AND eventCode = ?`, [teamNumber, matchNumber, eventCode]);
    return rows[0].count > 0;
  }

  // Custom events - basic CRUD
  async addCustomEvent(event: Omit<CustomEvent, "id">): Promise<number> {
    const pool = await this.getPool();
    const q = `INSERT INTO customEvents (eventCode, name, date, endDate, matchCount, location, region, year, competitionType) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const [result]: any = await pool.execute(q, [event.eventCode, event.name, event.date, event.endDate ?? null, event.matchCount, event.location ?? null, event.region ?? null, event.year, event.competitionType]);
    return result.insertId;
  }

  async getCustomEvent(eventCode: string, competitionType?: CompetitionType): Promise<CustomEvent | undefined> {
    const pool = await this.getPool();
    let sql = `SELECT * FROM customEvents WHERE eventCode = ?`;
    const params: any[] = [eventCode];
    if (competitionType) {
      sql += ` AND competitionType = ?`;
      params.push(competitionType);
    }
    const [rows]: any = await pool.execute(sql, params);
    if ((rows as any[]).length === 0) return undefined;
    const row = rows[0];
    return {
      id: row.id,
      eventCode: row.eventCode,
      name: row.name,
      date: row.date,
      endDate: row.endDate || undefined,
      matchCount: row.matchCount,
      location: row.location || undefined,
      region: row.region || undefined,
      year: row.year,
      competitionType: (row.competitionType || "FRC") as CompetitionType,
    } as CustomEvent;
  }

  async getAllCustomEvents(year?: number, competitionType?: CompetitionType): Promise<CustomEvent[]> {
    const pool = await this.getPool();
    let sql = `SELECT * FROM customEvents`;
    const conditions: string[] = [];
    const params: any[] = [];
    if (year !== undefined) {
      conditions.push(`year = ?`);
      params.push(year);
    }
    if (competitionType !== undefined) {
      conditions.push(`competitionType = ?`);
      params.push(competitionType);
    }
    if (conditions.length > 0) sql += ` WHERE ` + conditions.join(" AND ");
    sql += ` ORDER BY date DESC`;
    const [rows]: any = await pool.execute(sql, params);
    return (rows as any[]).map((row: any) => ({
      id: row.id,
      eventCode: row.eventCode,
      name: row.name,
      date: row.date,
      endDate: row.endDate || undefined,
      matchCount: row.matchCount,
      location: row.location || undefined,
      region: row.region || undefined,
      year: row.year,
      competitionType: (row.competitionType || "FRC") as CompetitionType,
    } as CustomEvent));
  }

  async updateCustomEvent(eventCode: string, updates: Partial<CustomEvent>): Promise<void> {
    const pool = await this.getPool();
    const setParts: string[] = [];
    const params: any[] = [];
    const validFields = ["name", "date", "endDate", "matchCount", "location", "region", "year"];
    for (const [key, value] of Object.entries(updates)) {
      if (validFields.includes(key)) {
        setParts.push(`${key} = ?`);
        params.push(value as any);
      }
    }
    if (setParts.length === 0) return;
    params.push(eventCode);
    const sql = `UPDATE customEvents SET ${setParts.join(", ")} WHERE eventCode = ?`;
    await pool.execute(sql, params);
  }

  async deleteCustomEvent(eventCode: string): Promise<void> {
    const pool = await this.getPool();
    // Fetch event metadata first
    const [metaRows]: any = await pool.execute(`SELECT year, competitionType FROM customEvents WHERE eventCode = ? LIMIT 1`, [eventCode]);
    if ((metaRows as any[]).length === 0) return;
    const year = metaRows[0].year as number;
    const competitionType = (metaRows[0].competitionType || "FRC") as CompetitionType;

    // Delete related data
    await pool.execute(`DELETE FROM matchAssignments WHERE eventCode = ? AND year = ?`, [eventCode, year]);
    await pool.execute(`DELETE FROM picklists WHERE eventCode = ? AND year = ? AND competitionType = ?`, [eventCode, year, competitionType]);
    await pool.execute(`DELETE FROM matchEntries WHERE eventCode = ? AND year = ? AND competitionType = ?`, [eventCode, year, competitionType]);
    await pool.execute(`DELETE FROM pitEntries WHERE eventCode = ? AND year = ? AND competitionType = ?`, [eventCode, year, competitionType]);
    await pool.execute(`DELETE FROM customEvents WHERE eventCode = ?`, [eventCode]);
  }

  // Picklist methods
  async addPicklist(picklist: Omit<Picklist, "id" | "created_at" | "updated_at">): Promise<number> {
    const pool = await this.getPool();
    const p: any = picklist as any;
    const q = `INSERT INTO picklists (eventCode, year, competitionType, picklistType, name, createdBy) VALUES (?, ?, ?, ?, ?, ?)`;
    const [result]: any = await pool.execute(q, [p.eventCode, p.year, p.competitionType, p.picklistType || "main", p.name || null, p.createdBy || null]);
    return result.insertId;
  }

  async getPicklist(id: number): Promise<Picklist | undefined> {
    const pool = await this.getPool();
    const [rows]: any = await pool.execute(`SELECT * FROM picklists WHERE id = ?`, [id]);
    if ((rows as any[]).length === 0) return undefined;
    const row = rows[0];
    return {
      id: row.id,
      eventCode: row.eventCode,
      year: row.year,
      competitionType: (row.competitionType || "FRC") as CompetitionType,
      picklistType: row.picklistType,
      name: row.name || undefined,
      createdBy: row.createdBy || undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    } as Picklist;
  }

  async getPicklistByEvent(eventCode: string, year: number, competitionType?: CompetitionType, picklistType?: string): Promise<Picklist | undefined> {
    const pool = await this.getPool();
    let sql = `SELECT * FROM picklists WHERE eventCode = ? AND year = ?`;
    const params: any[] = [eventCode, year];
    if (competitionType) {
      sql += ` AND competitionType = ?`;
      params.push(competitionType);
    }
    if (picklistType) {
      sql += ` AND picklistType = ?`;
      params.push(picklistType);
    }
    sql += ` ORDER BY id ASC LIMIT 1`;
    const [rows]: any = await pool.execute(sql, params);
    if ((rows as any[]).length === 0) return undefined;
    const row = rows[0];
    return {
      id: row.id,
      eventCode: row.eventCode,
      year: row.year,
      competitionType: (row.competitionType || "FRC") as CompetitionType,
      picklistType: row.picklistType,
      name: row.name || undefined,
      createdBy: row.createdBy || undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    } as Picklist;
  }

  async getPicklistsByEvent(eventCode: string, year: number, competitionType?: CompetitionType): Promise<Picklist[]> {
    const pool = await this.getPool();
    let sql = `SELECT * FROM picklists WHERE eventCode = ? AND year = ?`;
    const params: any[] = [eventCode, year];
    if (competitionType) {
      sql += ` AND competitionType = ?`;
      params.push(competitionType);
    }
    sql += ` ORDER BY picklistType, id`;
    const [rows]: any = await pool.execute(sql, params);
    return (rows as any[]).map((row: any) => ({
      id: row.id,
      eventCode: row.eventCode,
      year: row.year,
      competitionType: (row.competitionType || "FRC") as CompetitionType,
      picklistType: row.picklistType,
      name: row.name || undefined,
      createdBy: row.createdBy || undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    } as Picklist));
  }

  async updatePicklist(id: number, updates: Partial<Picklist>): Promise<void> {
    const pool = await this.getPool();
    const setParts: string[] = [];
    const params: any[] = [];
    const u: any = updates as any;
    if (u.name !== undefined) {
      setParts.push(`name = ?`);
      params.push(u.name);
    }
    if (u.picklistType !== undefined) {
      setParts.push(`picklistType = ?`);
      params.push(u.picklistType);
    }
    if (setParts.length === 0) return;
    setParts.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);
    const sql = `UPDATE picklists SET ${setParts.join(", ")} WHERE id = ?`;
    await pool.execute(sql, params);
  }

  async deletePicklist(id: number): Promise<void> {
    const pool = await this.getPool();
    await pool.execute(`DELETE FROM picklists WHERE id = ?`, [id]);
  }

  async addPicklistEntry(entry: Omit<PicklistEntry, "id" | "created_at" | "updated_at">): Promise<number> {
    const pool = await this.getPool();
    const q = `INSERT INTO picklistEntries (picklistId, teamNumber, rank, source, notes) VALUES (?, ?, ?, ?, ?)`;
    const [result]: any = await pool.execute({
      sql: q,
      values: [entry.picklistId, entry.teamNumber, entry.rank, null, null],
    });
    return result.insertId;
  }

  async getPicklistEntry(id: number): Promise<PicklistEntry | undefined> {
    const pool = await this.getPool();
    const [rows]: any = await pool.execute(`SELECT * FROM picklistEntries WHERE id = ?`, [id]);
    if ((rows as any[]).length === 0) return undefined;
    const row = rows[0];
    return row as PicklistEntry;
  }

  async getPicklistEntries(picklistId: number): Promise<PicklistEntry[]> {
    const pool = await this.getPool();
    const [rows]: any = await pool.execute(`SELECT * FROM picklistEntries WHERE picklistId = ? ORDER BY rank ASC`, [picklistId]);
    return rows as PicklistEntry[];
  }

  async updatePicklistEntry(id: number, updates: Partial<PicklistEntry>): Promise<void> {
    const pool = await this.getPool();
    const setParts: string[] = [];
    const params: any[] = [];
    const u: any = updates as any;
    if (u.rank !== undefined) {
      setParts.push(`rank = ?`);
      params.push(u.rank);
    }
    if (u.source !== undefined) {
      setParts.push(`source = ?`);
      params.push(u.source);
    }
    if (u.notes !== undefined) {
      setParts.push(`notes = ?`);
      params.push(u.notes);
    }
    if (setParts.length === 0) return;
    params.push(id);
    const sql = `UPDATE picklistEntries SET ${setParts.join(", ")} WHERE id = ?`;
    await pool.execute(sql, params);
  }

  async deletePicklistEntry(id: number): Promise<void> {
    const pool = await this.getPool();
    await pool.execute(`DELETE FROM picklistEntries WHERE id = ?`, [id]);
  }

  async updatePicklistEntryRank(picklistId: number, teamNumber: number, rank: number): Promise<void> {
    const pool = await this.getPool();
    await pool.execute(`UPDATE picklistEntries SET rank = ? WHERE picklistId = ? AND teamNumber = ?`, [rank, picklistId, teamNumber]);
  }

  async reorderPicklistEntries(picklistId: number, entries: Array<{ teamNumber: number; rank: number }>): Promise<void> {
    const pool = await this.getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const e of entries) {
        await conn.execute(`UPDATE picklistEntries SET rank = ? WHERE picklistId = ? AND teamNumber = ?`, [e.rank, picklistId, e.teamNumber]);
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async addPicklistNote(note: Omit<PicklistNote, "id" | "created_at" | "updated_at">): Promise<number> {
    const pool = await this.getPool();
    const q = `INSERT INTO picklistNotes (picklistId, teamNumber, note) VALUES (?, ?, ?)`;
    const [result]: any = await pool.execute(q, [note.picklistId, note.teamNumber, note.note]);
    return result.insertId;
  }

  async getPicklistNote(id: number): Promise<PicklistNote | undefined> {
    const pool = await this.getPool();
    const [rows]: any = await pool.execute(`SELECT * FROM picklistNotes WHERE id = ?`, [id]);
    if ((rows as any[]).length === 0) return undefined;
    return rows[0] as PicklistNote;
  }

  async getPicklistNotes(picklistId: number, teamNumber?: number): Promise<PicklistNote[]> {
    const pool = await this.getPool();
    let sql = `SELECT * FROM picklistNotes WHERE picklistId = ?`;
    const params: any[] = [picklistId];
    if (teamNumber !== undefined) {
      sql += ` AND teamNumber = ?`;
      params.push(teamNumber);
    }
    const [rows]: any = await pool.execute(sql, params);
    return rows as PicklistNote[];
  }

  async updatePicklistNote(id: number, updates: Partial<PicklistNote>): Promise<void> {
    const pool = await this.getPool();
    const setParts: string[] = [];
    const params: any[] = [];
    const u: any = updates as any;
    if (u.note !== undefined) {
      setParts.push(`note = ?`);
      params.push(u.note);
    }
    if (setParts.length === 0) return;
    params.push(id);
    await pool.execute(`UPDATE picklistNotes SET ${setParts.join(", ")} WHERE id = ?`, params);
  }

  async deletePicklistNote(id: number): Promise<void> {
    const pool = await this.getPool();
    await pool.execute(`DELETE FROM picklistNotes WHERE id = ?`, [id]);
  }

  async updateUserPreferredPartners(
    userId: string,
    preferredPartners: string[],
  ): Promise<void> {
    const pool = await this.getPool();
    await pool.execute(
      `UPDATE users SET preferredPartners = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [JSON.stringify(preferredPartners), userId],
    );
  }

  async getUserPreferredPartners(userId: string): Promise<string[]> {
    const pool = await this.getPool();
    const [rows]: any = await pool.execute(
      `SELECT preferredPartners FROM users WHERE id = ?`,
      [userId],
    );

    if ((rows as any[]).length === 0 || !rows[0].preferredPartners) {
      return [];
    }

    try {
      return JSON.parse(rows[0].preferredPartners);
    } catch {
      return [];
    }
  }

  async exportData(year?: number): Promise<{ pitEntries: PitEntry[]; matchEntries: MatchEntry[] }> {
    const pit = await this.getAllPitEntries(year);
    const matches = await this.getAllMatchEntries(year);
    return { pitEntries: pit, matchEntries: matches };
  }

  async importData(data: { pitEntries: PitEntry[]; matchEntries: MatchEntry[] }): Promise<void> {
    const pool = await this.getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const p of data.pitEntries) {
        const q = `INSERT INTO pitEntries (teamNumber, year, competitionType, driveTrain, weight, length, width, eventName, eventCode, userId, gameSpecificData, autoDrawing, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        await conn.execute(q, [p.teamNumber, p.year, p.competitionType, p.driveTrain, p.weight ?? null, p.length ?? null, p.width ?? null, p.eventName ?? null, p.eventCode ?? null, p.userId ?? null, JSON.stringify(p.gameSpecificData), p.autoDrawing ?? null, p.notes ?? null]);
      }
      for (const m of data.matchEntries) {
        const q = `INSERT INTO matchEntries (matchNumber, teamNumber, year, competitionType, alliance, alliancePosition, eventName, eventCode, userId, gameSpecificData, notes, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        await conn.execute(q, [m.matchNumber, m.teamNumber, m.year, m.competitionType, m.alliance, m.alliancePosition ?? null, m.eventName ?? null, m.eventCode ?? null, m.userId ?? null, JSON.stringify(m.gameSpecificData), m.notes ?? null, m.timestamp]);
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async resetDatabase(): Promise<void> {
    const pool = await this.getPool();
    // Drop all tables (careful)
    await pool.execute(`DROP TABLE IF EXISTS picklistNotes`);
    await pool.execute(`DROP TABLE IF EXISTS picklistEntries`);
    await pool.execute(`DROP TABLE IF EXISTS picklists`);
    await pool.execute(`DROP TABLE IF EXISTS matchAssignments`);
    await pool.execute(`DROP TABLE IF EXISTS customEvents`);
    await pool.execute(`DROP TABLE IF EXISTS matchEntries`);
    await pool.execute(`DROP TABLE IF EXISTS pitEntries`);
    await pool.execute(`DROP TABLE IF EXISTS users`);
    await this.initializeTables();
  }
}

export default MariaDbDatabaseService;
