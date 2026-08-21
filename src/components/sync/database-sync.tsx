"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, Cloud, Loader2 } from "lucide-react";

type DatabaseProvider = "azuresql" | "firebase" | "cosmos" | "mariadb";

type SummaryResponse = {
  currentProvider: DatabaseProvider;
  config: {
    provider: DatabaseProvider;
    azuresql?: { server: string; database: string };
    firebase?: { databaseURL: string; serviceAccountPath: string };
    cosmos?: { endpoint: string; databaseId: string; containerId: string };
    mariadb?: { host: string; port: number | null; database: string };
  };
};

function getProviderLabel(provider: DatabaseProvider) {
  switch (provider) {
    case "firebase":
      return "Firebase";
    case "cosmos":
      return "Cosmos DB";
    case "mariadb":
      return "MariaDB";
    default:
      return "Azure SQL";
  }
}

export function DatabaseSyncComponent() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SummaryResponse | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadSummary() {
      try {
        const response = await fetch("/api/scouting/admin/provider-options");
        if (!response.ok) {
          throw new Error("Failed to load database summary");
        }

        const json = (await response.json()) as SummaryResponse;
        if (mounted) {
          setData(json);
        }
      } catch (error) {
        console.error("Failed to load database summary:", error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadSummary();

    return () => {
      mounted = false;
    };
  }, []);

  const provider = data?.currentProvider ?? "azuresql";
  const providerLabel = getProviderLabel(provider);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Database Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading database status...
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Cloud className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">{providerLabel}</span>
              <Badge variant="secondary">Active</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              This application is currently using the {providerLabel} provider
              for centralized data storage.
            </p>
            <div className="text-xs text-muted-foreground space-y-1">
              {provider === "azuresql" && (
                <>
                  <div>Database: {data?.config.azuresql?.database || "-"}</div>
                  <div>Server: {data?.config.azuresql?.server || "-"}</div>
                </>
              )}
              {provider === "firebase" && (
                <>
                  <div>Database URL: {data?.config.firebase?.databaseURL || "-"}</div>
                  <div>Service account: {data?.config.firebase?.serviceAccountPath || "-"}</div>
                </>
              )}
              {provider === "cosmos" && (
                <>
                  <div>Database ID: {data?.config.cosmos?.databaseId || "-"}</div>
                  <div>Container ID: {data?.config.cosmos?.containerId || "-"}</div>
                </>
              )}
              {provider === "mariadb" && (
                <>
                  <div>Database: {data?.config.mariadb?.database || "-"}</div>
                  <div>
                    Host: {data?.config.mariadb?.host || "-"}
                    {data?.config.mariadb?.port ? `:${data.config.mariadb.port}` : ""}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
