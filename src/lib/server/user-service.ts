import bcrypt from "bcryptjs";
import { databaseManager } from "@/db/database-manager";

export const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,20}$/;
export const VALID_ROLES = [
  "admin",
  "lead_scout",
  "scout",
  "tablet",
  "viewer",
  "external",
] as const;

export type UserRole = (typeof VALID_ROLES)[number];

export interface ValidationResult {
  valid: boolean;
  error?: string;
  cleanData?: {
    name: string;
    username: string;
    password: string;
    role: string;
  };
}

export function validateUserCredentials(data: {
  name?: unknown;
  username?: unknown;
  password?: unknown;
  role?: unknown;
}): ValidationResult {
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const username =
    typeof data.username === "string" ? data.username.trim() : "";
  const password = typeof data.password === "string" ? data.password : "";
  const role = typeof data.role === "string" ? data.role : "scout";

  if (!name || !username || !password) {
    return { valid: false, error: "Name, username, and password are required" };
  }

  if (!USERNAME_REGEX.test(username)) {
    return {
      valid: false,
      error:
        "Username must be 3-20 characters and contain only letters, numbers, underscores, or dashes",
    };
  }

  if (password.length < 8) {
    return {
      valid: false,
      error: "Password must be at least 8 characters long",
    };
  }

  if (!VALID_ROLES.includes(role as UserRole)) {
    return {
      valid: false,
      error: "Invalid role specified",
    };
  }

  return {
    valid: true,
    cleanData: { name, username, password, role },
  };
}

export async function hasAnyAdmin(): Promise<boolean> {
  const db = databaseManager.getService();
  if (!db || !db.query) return false;

  const result = await db.query<{ count?: number }>(
    "SELECT COUNT(*) as count FROM users WHERE role = 'admin'",
  );
  const row = result?.recordset?.[0];
  if (!row) return false;
  if (typeof row.count !== "undefined") {
    return Number(row.count) > 0;
  }
  return true;
}

export async function createUser(data: {
  name: string;
  username: string;
  password: string;
  role?: string;
}): Promise<{
  success: boolean;
  error?: string;
  status: number;
  userId?: string;
}> {
  const validation = validateUserCredentials(data);
  if (!validation.valid || !validation.cleanData) {
    return { success: false, error: validation.error, status: 400 };
  }

  const { name, username, password, role } = validation.cleanData;

  const db = databaseManager.getService();
  if (!db || !db.query) {
    return {
      success: false,
      error: "Database service does not support direct SQL queries",
      status: 500,
    };
  }

  // Check if username already exists
  const existingUserResult = await db.query<{ id: string }>(
    "SELECT id FROM users WHERE username = @username",
    { username },
  );

  if (existingUserResult.recordset.length > 0) {
    return {
      success: false,
      error: "User with this username already exists",
      status: 409,
    };
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);
  const userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

  // Insert user
  await db.query(
    `
      INSERT INTO users (id, name, username, password_hash, role, created_at, updated_at)
      VALUES (@id, @name, @username, @passwordHash, @role, GETDATE(), GETDATE())
    `,
    {
      id: userId,
      name,
      username,
      passwordHash: hashedPassword,
      role,
    },
  );

  return { success: true, userId, status: 201 };
}
