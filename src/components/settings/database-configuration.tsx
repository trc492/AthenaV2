"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Save, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DatabaseProviderFields } from "@/components/database-provider-fields";
import { defaultDatabaseFormState, type DatabaseFormState, type DatabaseProvider } from "@/lib/types/db/providers";

type ProviderSummary = {
  provider: DatabaseProvider;
  azuresql?: {
    server: string;
    database: string;
    user: string;
    useManagedIdentity: boolean;
    hasConnectionString: boolean;
    hasPassword: boolean;
  };
  firebase?: {
    serviceAccountPath: string;
    databaseURL: string;
    hasServiceAccountJson: boolean;
  };
  cosmos?: {
    endpoint: string;
    databaseId: string;
    containerId: string;
    hasKey: boolean;
  };
  mariadb?: {
    connectionString: string;
    host: string;
    port: number | null;
    database: string;
    user: string;
    hasPassword: boolean;
    hasConnectionString: boolean;
  };
};

type DatabaseOptionsResponse = {
  currentProvider: DatabaseProvider;
  providers: DatabaseProvider[];
  config: ProviderSummary;
};

export function DatabaseConfigurationComponent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentProvider, setCurrentProvider] = useState<DatabaseProvider>("azuresql");
  const [providers, setProviders] = useState<DatabaseProvider[]>([]);
  const [form, setForm] = useState<DatabaseFormState>(defaultDatabaseFormState);

  useEffect(() => {
    let mounted = true;

    async function loadConfig() {
      try {
        const response = await fetch("/api/scouting/admin/provider-options");
        if (!response.ok) {
          throw new Error("Failed to load database configuration");
        }

        const data = (await response.json()) as DatabaseOptionsResponse;
        if (!mounted) return;

        setCurrentProvider(data.currentProvider);
        setProviders(data.providers);
        setForm({
          provider: data.config.provider,
          azuresql: {
            connectionString: "",
            server: data.config.azuresql?.server ?? "",
            database: data.config.azuresql?.database ?? "",
            user: data.config.azuresql?.user ?? "",
            password: "",
            useManagedIdentity: data.config.azuresql?.useManagedIdentity ?? false,
          },
          firebase: {
            serviceAccountPath: data.config.firebase?.serviceAccountPath ?? "",
            serviceAccountJson: "",
            databaseURL: data.config.firebase?.databaseURL ?? "",
          },
          cosmos: {
            endpoint: data.config.cosmos?.endpoint ?? "",
            key: "",
            databaseId: data.config.cosmos?.databaseId ?? "",
            containerId: data.config.cosmos?.containerId ?? "",
          },
          mariadb: {
            connectionString: "",
            host: data.config.mariadb?.host ?? "",
            port: data.config.mariadb?.port?.toString() ?? "",
            database: data.config.mariadb?.database ?? "",
            user: data.config.mariadb?.user ?? "",
            password: "",
          },
        });
      } catch (fetchError) {
        console.error("Failed to load database configuration:", fetchError);
        if (mounted) {
          setError(
            fetchError instanceof Error ? fetchError.message : "Failed to load database configuration",
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadConfig();
    return () => {
      mounted = false;
    };
  }, []);

  const activeSummary = useMemo(() => {
    switch (currentProvider) {
      case "firebase":
        return "Firebase database configuration is active.";
      case "cosmos":
        return "Cosmos DB configuration is active.";
      case "mariadb":
        return "MariaDB configuration is active.";
      default:
        return "Azure SQL configuration is active.";
    }
  }, [currentProvider]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/scouting/admin/provider-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: form.provider,
          azuresql: {
            connectionString: form.azuresql.connectionString,
            server: form.azuresql.server,
            database: form.azuresql.database,
            user: form.azuresql.user,
            password: form.azuresql.password,
            useManagedIdentity: form.azuresql.useManagedIdentity,
          },
          firebase: {
            serviceAccountPath: form.firebase.serviceAccountPath,
            serviceAccountJson: form.firebase.serviceAccountJson
              ? JSON.parse(form.firebase.serviceAccountJson)
              : undefined,
            databaseURL: form.firebase.databaseURL,
          },
          cosmos: {
            endpoint: form.cosmos.endpoint,
            key: form.cosmos.key,
            databaseId: form.cosmos.databaseId,
            containerId: form.cosmos.containerId,
          },
          mariadb: {
            connectionString: form.mariadb.connectionString,
            host: form.mariadb.host,
            port: form.mariadb.port ? Number(form.mariadb.port) : undefined,
            database: form.mariadb.database,
            user: form.mariadb.user,
            password: form.mariadb.password,
          },
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to update configuration");
      }

      setCurrentProvider(result.currentProvider);
      toast.success("Database configuration updated", {
        description: "The new provider is active for this server instance.",
      });
      router.refresh();
    } catch (saveError) {
      console.error("Database configuration update failed:", saveError);
      const message = saveError instanceof Error ? saveError.message : "Unknown error";
      setError(message);
      toast.error("Failed to update database configuration", { description: message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Admin Database Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading database configuration...
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-950 dark:text-amber-100">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="space-y-1">
                  <p className="font-medium">Persisted runtime config</p>
                  <p>
                    This updates the active server instance immediately and writes the chosen provider
                    settings to
                    <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">
                      .runtime/database-config.json
                    </code>
                    . Mount that path as a Docker volume if you want the change to survive container
                    rebuilds.
                  </p>
                </div>
              </div>
            </div>
            {providers.length > 0 && (
              <DatabaseProviderFields
                value={form}
                onChange={setForm}
                mode="edit"
                availableProviders={providers}
              />
            )}

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {saving ? "Saving..." : "Save configuration"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}