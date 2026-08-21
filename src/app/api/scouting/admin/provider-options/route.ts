import { NextRequest, NextResponse } from "next/server";
import { DatabaseConfig, DatabaseProvider } from "@/lib/types";
import { DatabaseManager } from "@/db/database-manager";
import { auth } from "@/lib/auth/config";
import { hasPermission, PERMISSIONS } from "@/lib/auth/roles";
import { savePersistedDatabaseConfig } from "@/lib/server/env-file";

const providers: DatabaseProvider[] = [
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

function summarizeConfig(config: DatabaseConfig) {
  return {
    provider: config.provider,
    azuresql: config.azuresql
      ? {
          server: config.azuresql.server ?? "",
          database: config.azuresql.database ?? "",
          user: config.azuresql.user ?? "",
          useManagedIdentity: config.azuresql.useManagedIdentity ?? false,
          hasConnectionString: !!config.azuresql.connectionString,
          hasPassword: !!config.azuresql.password,
        }
      : undefined,
    firebase: config.firebase
      ? {
          serviceAccountPath: config.firebase.serviceAccountPath ?? "",
          databaseURL: config.firebase.databaseURL ?? "",
          hasServiceAccountJson: !!config.firebase.serviceAccountJson,
        }
      : undefined,
    cosmos: config.cosmos
      ? {
          endpoint: config.cosmos.endpoint ?? "",
          databaseId: config.cosmos.databaseId ?? "",
          containerId: config.cosmos.containerId ?? "",
          hasKey: !!config.cosmos.key,
        }
      : undefined,
    mariadb: config.mariadb
      ? {
          connectionString: config.mariadb.connectionString ?? "",
          host: config.mariadb.host ?? "",
          port: config.mariadb.port ?? null,
          database: config.mariadb.database ?? "",
          user: config.mariadb.user ?? "",
          hasPassword: !!config.mariadb.password,
          hasConnectionString: !!config.mariadb.connectionString,
        }
      : undefined,
  };
}

function mergeConfig(config: DatabaseConfig, current: DatabaseConfig): DatabaseConfig {
  if (config.provider === "azuresql") {
    const currentAzure = current.provider === "azuresql" ? current.azuresql : undefined;
    const azureSql = config.azuresql ?? {};
    const connectionString = cleanString(azureSql.connectionString) ?? currentAzure?.connectionString;
    const server = cleanString(azureSql.server) ?? currentAzure?.server;
    const database = cleanString(azureSql.database) ?? currentAzure?.database;
    const user = cleanString(azureSql.user) ?? currentAzure?.user;
    const password = cleanString(azureSql.password) ?? currentAzure?.password;
    const useManagedIdentity = azureSql.useManagedIdentity ?? currentAzure?.useManagedIdentity ?? false;

    return {
      provider: "azuresql",
      azuresql: connectionString
        ? { connectionString, useManagedIdentity }
        : { server, database, user, password, useManagedIdentity },
    };
  }

  if (config.provider === "firebase") {
    const currentFirebase = current.provider === "firebase" ? current.firebase : undefined;
    return {
      provider: "firebase",
      firebase: {
        serviceAccountPath:
          cleanString(config.firebase?.serviceAccountPath) ??
          currentFirebase?.serviceAccountPath,
        serviceAccountJson:
          config.firebase?.serviceAccountJson ?? currentFirebase?.serviceAccountJson,
        databaseURL:
          cleanString(config.firebase?.databaseURL) ?? currentFirebase?.databaseURL,
      },
    };
  }

  if (config.provider === "cosmos") {
    const currentCosmos = current.provider === "cosmos" ? current.cosmos : undefined;
    return {
      provider: "cosmos",
      cosmos: {
        endpoint: cleanString(config.cosmos?.endpoint) ?? currentCosmos?.endpoint,
        key: cleanString(config.cosmos?.key) ?? currentCosmos?.key,
        databaseId:
          cleanString(config.cosmos?.databaseId) ?? currentCosmos?.databaseId,
        containerId:
          cleanString(config.cosmos?.containerId) ?? currentCosmos?.containerId,
      },
    };
  }

  const currentMariaDb = current.provider === "mariadb" ? current.mariadb : undefined;
  const port =
    typeof config.mariadb?.port === "number" && Number.isFinite(config.mariadb.port)
      ? config.mariadb.port
      : currentMariaDb?.port;

  return {
    provider: "mariadb",
    mariadb: {
      connectionString:
        cleanString(config.mariadb?.connectionString) ??
        currentMariaDb?.connectionString,
      host: cleanString(config.mariadb?.host) ?? currentMariaDb?.host,
      port,
      database: cleanString(config.mariadb?.database) ?? currentMariaDb?.database,
      user: cleanString(config.mariadb?.user) ?? currentMariaDb?.user,
      password: cleanString(config.mariadb?.password) ?? currentMariaDb?.password,
    },
  };
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

export async function GET() {
  const manager = DatabaseManager.getInstance();
  const config = manager.getConfig();

  return NextResponse.json({
    currentProvider: config?.provider ?? "azuresql",
    providers,
    config: config ? summarizeConfig(config) : { provider: "azuresql" },
  });
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (
      !session?.user?.role ||
      !hasPermission(session.user.role, PERMISSIONS.MANAGE_SYSTEM_CONFIG)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const provider = body?.provider as DatabaseProvider | undefined;
    if (!provider || !providers.includes(provider)) {
      return NextResponse.json(
        { error: "A valid database provider is required" },
        { status: 400 },
      );
    }

    const manager = DatabaseManager.getInstance();
    const currentConfig = manager.getConfig() ?? { provider };
    const mergedConfig = mergeConfig(
      {
        provider,
        azuresql: body?.azuresql,
        firebase: body?.firebase,
        cosmos: body?.cosmos,
        mariadb: body?.mariadb,
      },
      currentConfig,
    );

    const validationError = validateConfig(mergedConfig);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    await savePersistedDatabaseConfig(mergedConfig);
    manager.configure(mergedConfig);

    return NextResponse.json({
      success: true,
      message: "Database configuration updated successfully",
      currentProvider: mergedConfig.provider,
      config: summarizeConfig(manager.getConfig()!),
    });
  } catch (error) {
    console.error("Error updating database configuration:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update configuration",
      },
      { status: 500 },
    );
  }
}
