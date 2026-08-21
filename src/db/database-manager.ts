import { DatabaseService, DatabaseConfig, DatabaseProvider } from "@/lib/types";
import { AzureSqlDatabaseService } from "./azuresql-database-service";
import { FirebaseDatabaseService } from "./firebase-database-service";
import { CosmosDatabaseService } from "./cosmos-database-service";
import { MariaDbDatabaseService } from "./mariadb-database-service";
import { loadPersistedDatabaseConfig } from "@/lib/server/env-file";

class DatabaseManager {
  private static instance: DatabaseManager;
  private currentService: DatabaseService | null = null;
  private config: DatabaseConfig | null = null;

  private constructor() {
    this.initFromEnvOrPersisted();
  }

  public initFromEnvOrPersisted(): void {
    const persistedConfig = loadPersistedDatabaseConfig();

    if (persistedConfig) {
      try {
        this.config = persistedConfig;
        this.currentService = this.createService(persistedConfig);
        return;
      } catch (error) {
        console.warn(
          "Ignoring persisted database config and falling back to env detection:",
          error,
        );
      }
    }

    // Allow explicit provider override via env var
    const envProvider = (process.env.DATABASE_PROVIDER || "").toLowerCase() as
      | DatabaseProvider
      | "";

    // Azure SQL envs
    const azureSqlConnectionString = process.env.AZURE_SQL_CONNECTION_STRING;
    const azureSqlServer = process.env.AZURE_SQL_SERVER;
    const azureSqlDatabase = process.env.AZURE_SQL_DATABASE;
    const azureSqlUser = process.env.AZURE_SQL_USER;
    const azureSqlPassword = process.env.AZURE_SQL_PASSWORD;
    const useManagedIdentity =
      process.env.AZURE_SQL_USE_MANAGED_IDENTITY === "true" ||
      !azureSqlUser ||
      !azureSqlPassword;

    const isAzureSqlConfigured =
      azureSqlConnectionString || (azureSqlServer && azureSqlDatabase);

    // MariaDB / MySQL envs
    const mariadbConnectionString =
      process.env.MARIADB_CONNECTION_STRING ||
      process.env.MYSQL_CONNECTION_STRING;
    const mariadbHost = process.env.MARIADB_HOST || process.env.MYSQL_HOST;
    const mariadbDatabase =
      process.env.MARIADB_DATABASE || process.env.MYSQL_DATABASE;
    const mariadbUser = process.env.MARIADB_USER || process.env.MYSQL_USER;
    const mariadbPassword =
      process.env.MARIADB_PASSWORD || process.env.MYSQL_PASSWORD;
    const mariadbPort = process.env.MARIADB_PORT
      ? parseInt(process.env.MARIADB_PORT, 10)
      : process.env.MYSQL_PORT
        ? parseInt(process.env.MYSQL_PORT, 10)
        : undefined;
    const isMariaDbConfigured = !!(
      mariadbConnectionString ||
      (mariadbHost && mariadbDatabase)
    );

    // Cosmos envs
    const cosmosEndpoint = process.env.COSMOS_ENDPOINT;
    const cosmosKey = process.env.COSMOS_KEY;
    const cosmosDatabaseId = process.env.COSMOS_DATABASE_ID;
    const cosmosContainerId = process.env.COSMOS_CONTAINER_ID;

    // Firebase envs
    const firebaseServiceAccountPath =
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    const firebaseServiceAccountJson =
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const firebaseDatabaseURL = process.env.FIREBASE_DATABASE_URL;

    // Choose provider: explicit env override first, then best-detect
    let selected: DatabaseProvider | null = null;
    if (
      envProvider === "firebase" ||
      envProvider === "cosmos" ||
      envProvider === "azuresql" ||
      envProvider === "mariadb"
    ) {
      selected = envProvider as DatabaseProvider;
    } else if (isAzureSqlConfigured) {
      selected = "azuresql";
    } else if (cosmosEndpoint && cosmosKey) {
      selected = "cosmos";
    } else if (firebaseServiceAccountPath || firebaseServiceAccountJson) {
      selected = "firebase";
    } else if (isMariaDbConfigured) {
      selected = "mariadb";
    } else {
      this.config = null;
      this.currentService = null;
      return;
    }

    try {
      // Build config and instantiate service
      if (selected === "azuresql") {
        this.config = {
          provider: "azuresql",
          azuresql:
            azureSqlServer && azureSqlDatabase
              ? {
                  server: azureSqlServer,
                  database: azureSqlDatabase,
                  user: useManagedIdentity ? undefined : azureSqlUser,
                  password: useManagedIdentity ? undefined : azureSqlPassword,
                  useManagedIdentity: useManagedIdentity,
                }
              : {
                  connectionString: azureSqlConnectionString,
                  useManagedIdentity: false,
                },
        };
        this.currentService = new AzureSqlDatabaseService(this.config.azuresql!);
      } else if (selected === "cosmos") {
        this.config = {
          provider: "cosmos",
          cosmos: {
            endpoint: cosmosEndpoint,
            key: cosmosKey,
            databaseId: cosmosDatabaseId,
            containerId: cosmosContainerId,
          },
        };
        this.currentService = new CosmosDatabaseService(this.config.cosmos);
      } else if (selected === "firebase") {
        const saJson = firebaseServiceAccountJson
          ? JSON.parse(firebaseServiceAccountJson)
          : undefined;
        this.config = {
          provider: "firebase",
          firebase: {
            serviceAccountPath: firebaseServiceAccountPath,
            serviceAccountJson: saJson,
            databaseURL: firebaseDatabaseURL,
          },
        } as DatabaseConfig;
        this.currentService = new FirebaseDatabaseService(this.config.firebase);
      } else if (selected === "mariadb") {
        this.config = {
          provider: "mariadb",
          mariadb: mariadbConnectionString
            ? { connectionString: mariadbConnectionString }
            : {
                host: mariadbHost,
                port: mariadbPort,
                database: mariadbDatabase,
                user: mariadbUser,
                password: mariadbPassword,
              },
        } as DatabaseConfig;
        this.currentService = new MariaDbDatabaseService(this.config.mariadb!);
      }
    } catch (err) {
      console.warn("Failed to initialize database provider from environment:", err);
      this.config = null;
      this.currentService = null;
    }
  }

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  isConfigured(): boolean {
    return this.currentService !== null;
  }

  configure(config: DatabaseConfig): void {
    this.config = config;
    this.currentService = this.createService(config);
  }

  private createService(config: DatabaseConfig): DatabaseService {
    if (config.provider === "azuresql" && config.azuresql) {
      return new AzureSqlDatabaseService(config.azuresql);
    }
    if (config.provider === "firebase" && config.firebase) {
      return new FirebaseDatabaseService(config.firebase);
    }
    if (config.provider === "cosmos" && config.cosmos) {
      return new CosmosDatabaseService(config.cosmos);
    }
    if (
      config.provider === "mariadb" &&
      (config.mariadb || (config as any).local)
    ) {
      // Accept either explicit mariadb config or fall back to local-style config
      const cfg = config.mariadb ?? (config as any).local;
      return new MariaDbDatabaseService(cfg as any);
    }
    throw new Error("Invalid database configuration");
  }

  getService(): DatabaseService {
    if (!this.currentService) {
      this.initFromEnvOrPersisted();
    }
    if (!this.currentService) {
      throw new Error(
        "No database provider is currently configured. Please complete setup.",
      );
    }
    return this.currentService;
  }

  getConfig(): DatabaseConfig | null {
    if (!this.config) {
      this.initFromEnvOrPersisted();
    }
    return this.config;
  }

  // Convenience methods that delegate to the current service
  async exportData(year?: number) {
    return this.getService().exportData(year);
  }

  async importData(data: Parameters<DatabaseService["importData"]>[0]) {
    return this.getService().importData(data);
  }

  async resetDatabase() {
    return this.getService().resetDatabase();
  }

  async switchProvider(
    provider: DatabaseProvider,
    config?: Partial<DatabaseConfig>,
  ) {
    const newConfig: DatabaseConfig = {
      ...(this.config ?? { provider }),
      provider,
      ...config,
    };
    this.configure(newConfig);
  }
}

// Export singleton instance
export const databaseManager = DatabaseManager.getInstance();
export { DatabaseManager };
