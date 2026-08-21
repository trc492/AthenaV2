import { NextRequest, NextResponse } from "next/server";
import { DatabaseConfig, DatabaseProvider } from "@/lib/types";
import { DatabaseManager } from "@/db/database-manager";
import { savePersistedDatabaseConfig } from "@/lib/server/env-file";

const VALID_PROVIDERS: DatabaseProvider[] = [
  "azuresql",
  "firebase",
  "cosmos",
  "mariadb",
];

function cleanString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function validateConfig(config: DatabaseConfig): string | null {
  if (config.provider === "azuresql") {
    const azureSql = config.azuresql;
    if (!azureSql) {
      return "Azure SQL configuration is required";
    }
    if (!azureSql.connectionString && (!azureSql.server || !azureSql.database)) {
      return "Azure SQL requires either a connection string or server and database";
    }
  }

  if (config.provider === "firebase") {
    const firebase = config.firebase;
    if (!firebase) {
      return "Firebase configuration is required";
    }
    if (!firebase.serviceAccountPath && !firebase.serviceAccountJson) {
      return "Firebase requires either a service account path or JSON credentials";
    }
  }

  if (config.provider === "cosmos") {
    const cosmos = config.cosmos;
    if (!cosmos || !cosmos.endpoint || !cosmos.key) {
      return "Cosmos DB requires both an endpoint and key";
    }
  }

  if (config.provider === "mariadb") {
    const mariadb = config.mariadb;
    if (!mariadb) {
      return "MariaDB configuration is required";
    }
    if (!mariadb.connectionString && (!mariadb.host || !mariadb.database)) {
      return "MariaDB requires either a connection string or host and database";
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const provider = body?.provider as DatabaseProvider | undefined;

    if (!provider || !VALID_PROVIDERS.includes(provider)) {
      return NextResponse.json(
        { error: "A valid database provider is required" },
        { status: 400 },
      );
    }

    let config: DatabaseConfig;

    if (provider === "azuresql") {
      const az = body?.azuresql ?? {};
      const connectionString = cleanString(az.connectionString);
      const server = cleanString(az.server);
      const database = cleanString(az.database);
      const user = cleanString(az.user);
      const password = cleanString(az.password);
      const useManagedIdentity = az.useManagedIdentity ?? false;

      config = {
        provider: "azuresql",
        azuresql: connectionString
          ? { connectionString, useManagedIdentity }
          : { server, database, user, password, useManagedIdentity },
      };
    } else if (provider === "firebase") {
      const fb = body?.firebase ?? {};
      const serviceAccountJson = fb.serviceAccountJson
        ? typeof fb.serviceAccountJson === "string"
          ? JSON.parse(fb.serviceAccountJson)
          : fb.serviceAccountJson
        : undefined;

      config = {
        provider: "firebase",
        firebase: {
          serviceAccountPath: cleanString(fb.serviceAccountPath),
          serviceAccountJson,
          databaseURL: cleanString(fb.databaseURL),
        },
      };
    } else if (provider === "cosmos") {
      const cs = body?.cosmos ?? {};
      config = {
        provider: "cosmos",
        cosmos: {
          endpoint: cleanString(cs.endpoint),
          key: cleanString(cs.key),
          databaseId: cleanString(cs.databaseId),
          containerId: cleanString(cs.containerId),
        },
      };
    } else {
      const mb = body?.mariadb ?? {};
      const port =
        typeof mb.port === "number"
          ? mb.port
          : typeof mb.port === "string" && mb.port.trim().length > 0
            ? parseInt(mb.port, 10)
            : undefined;

      config = {
        provider: "mariadb",
        mariadb: {
          connectionString: cleanString(mb.connectionString),
          host: cleanString(mb.host),
          port: Number.isNaN(port) ? undefined : port,
          database: cleanString(mb.database),
          user: cleanString(mb.user),
          password: cleanString(mb.password),
        },
      };
    }

    const validationError = validateConfig(config);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const manager = DatabaseManager.getInstance();

    // Reconfigure the manager with the new configuration
    manager.configure(config);

    // Verify service readiness
    const service = manager.getService();
    if (service.query) {
      await service.query("SELECT 1 AS healthcheck");
    }

    // Persist configuration so it survives server restarts
    await savePersistedDatabaseConfig(config);

    return NextResponse.json({
      success: true,
      message: "Database connection verified and saved successfully",
      provider: config.provider,
    });
  } catch (error) {
    console.error("Database setup error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not connect to the database with the provided settings",
      },
      { status: 500 },
    );
  }
}
