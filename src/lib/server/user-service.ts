import crypto from "crypto";
import bcrypt from "bcryptjs";
import { databaseManager } from "@/db/database-manager";

export const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,20}$/;
export const VALID_ROLES = [
  "admin",
  "lead_scout",
  "scout",
  "tablet",
  "viewer",
] as const;

export type UserRole = (typeof VALID_ROLES)[number];

function normalizeAccountName(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

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
  return db?.users ? db.users.hasAdmin() : false;
}

export async function createUser(
  data: {
    name: string;
    username: string;
    password: string;
    role?: string;
  },
  options: { preventDuplicateName?: boolean } = {},
): Promise<{
  success: boolean;
  error?: string;
  status: number;
  userId?: string;
  code?: string;
}> {
  const validation = validateUserCredentials(data);
  if (!validation.valid || !validation.cleanData) {
    return { success: false, error: validation.error, status: 400 };
  }

  const { name, username, password, role } = validation.cleanData;

  const db = databaseManager.getService();
  if (!db || !db.users) {
    return {
      success: false,
      error: "User management is not supported by this database provider",
      status: 500,
    };
  }

  // Check if username already exists
  const existingUser = await db.users.getByUsername(username);

  if (existingUser) {
    return {
      success: false,
      error:
        "This username is already in use. Log in to your existing account or contact an administrator for help.",
      code: "DUPLICATE_ACCOUNT",
      status: 409,
    };
  }

  // Names are a hint, not proof of identity. Admins can create namesakes.
  if (options.preventDuplicateName) {
    const existingNames = await db.users.list(true);
    if (
      existingNames.some(
        (user) =>
          normalizeAccountName(user.name) === normalizeAccountName(name),
      )
    ) {
      return {
        success: false,
        error:
          "An account with this name already exists. Log in, or contact an administrator if you forgot your login or share a name with another person.",
        status: 409,
        code: "DUPLICATE_ACCOUNT",
      };
    }
  }

  // Hash password and generate a collision-resistant user ID
  const hashedPassword = await bcrypt.hash(password, 12);
  const userId = `user_${crypto.randomUUID().replace(/-/g, "")}`;

  // Insert user
  try {
    await db.users.create({
      id: userId,
      name,
      username,
      passwordHash: hashedPassword,
      role,
    });
  } catch (error) {
    // The document providers reserve usernames atomically; another signup can
    // win after the initial availability check.
    if (error instanceof Error && error.name === "DuplicateUsernameError") {
      return { success: false, status: 409, code: "DUPLICATE_ACCOUNT", error: error.message };
    }
    throw error;
  }

  return { success: true, userId, status: 201 };
}
