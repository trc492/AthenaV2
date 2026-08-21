export type DatabaseProvider = "azuresql" | "firebase" | "cosmos" | "mariadb";

export interface DatabaseFormState {
  provider: DatabaseProvider;
  azuresql: {
    connectionString: string;
    server: string;
    database: string;
    user: string;
    password: string;
    useManagedIdentity: boolean;
  };
  firebase: {
    serviceAccountPath: string;
    serviceAccountJson: string;
    databaseURL: string;
  };
  cosmos: {
    endpoint: string;
    key: string;
    databaseId: string;
    containerId: string;
  };
  mariadb: {
    connectionString: string;
    host: string;
    port: string;
    database: string;
    user: string;
    password: string;
  };
}

export const defaultDatabaseFormState: DatabaseFormState = {
  provider: "azuresql",
  azuresql: {
    connectionString: "",
    server: "",
    database: "",
    user: "",
    password: "",
    useManagedIdentity: false,
  },
  firebase: {
    serviceAccountPath: "",
    serviceAccountJson: "",
    databaseURL: "",
  },
  cosmos: {
    endpoint: "",
    key: "",
    databaseId: "",
    containerId: "",
  },
  mariadb: {
    connectionString: "",
    host: "",
    port: "",
    database: "",
    user: "",
    password: "",
  },
};

export const DATABASE_PROVIDERS: { value: DatabaseProvider; label: string }[] = [
  { value: "azuresql", label: "Azure SQL" },
  { value: "firebase", label: "Firebase" },
  { value: "cosmos", label: "Cosmos DB" },
  { value: "mariadb", label: "MariaDB" },
];

/**
 * Whether the form has enough information to attempt a connection.
 * Used by the setup wizard, where every field is starting from empty.
 * Not used by the admin edit form, where blank secret fields legitimately
 * mean "keep the existing value."
 */
export function isDatabaseFormValid(form: DatabaseFormState): boolean {
  switch (form.provider) {
    case "azuresql":
      return (
        form.azuresql.connectionString.trim().length > 0 ||
        (form.azuresql.server.trim().length > 0 && form.azuresql.database.trim().length > 0)
      );
    case "firebase":
      return (
        form.firebase.databaseURL.trim().length > 0 &&
        (form.firebase.serviceAccountPath.trim().length > 0 ||
          form.firebase.serviceAccountJson.trim().length > 0)
      );
    case "cosmos":
      return (
        form.cosmos.endpoint.trim().length > 0 &&
        form.cosmos.key.trim().length > 0 &&
        form.cosmos.databaseId.trim().length > 0 &&
        form.cosmos.containerId.trim().length > 0
      );
    case "mariadb":
      return (
        form.mariadb.connectionString.trim().length > 0 ||
        (form.mariadb.host.trim().length > 0 &&
          form.mariadb.database.trim().length > 0 &&
          form.mariadb.user.trim().length > 0)
      );
    default:
      return false;
  }
}