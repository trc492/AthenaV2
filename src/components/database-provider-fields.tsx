"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DATABASE_PROVIDERS, type DatabaseFormState, type DatabaseProvider } from "@/lib/types/db/providers";
import { HelpTooltip } from "./ui/help-tooltip";

interface DatabaseProviderFieldsProps {
  value: DatabaseFormState;
  onChange: (value: DatabaseFormState) => void;
  /**
   * "setup"  – first-run flow, every field starts empty and is required as entered.
   * "edit"   – editing an existing config; secret fields are optional and
   *            blank means "keep the current value" (shown via placeholder).
   */
  mode?: "setup" | "edit";
  /** Restrict the dropdown to a subset of providers. Defaults to all four. */
  availableProviders?: DatabaseProvider[];
}

export function DatabaseProviderFields({
  value,
  onChange,
  mode = "setup",
  availableProviders,
}: DatabaseProviderFieldsProps) {
  const secretPlaceholder = (base: string) =>
    mode === "edit" ? "Leave blank to keep the current value" : base;
  const providerOptions = availableProviders
    ? DATABASE_PROVIDERS.filter((p) => availableProviders.includes(p.value))
    : DATABASE_PROVIDERS;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Database provider</Label>
        <Select
          value={value.provider}
          onValueChange={(provider) => onChange({ ...value, provider: provider as DatabaseProvider })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select provider" />
          </SelectTrigger>
          <SelectContent>
            {providerOptions.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {value.provider === "azuresql" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Connection string</Label>
            <Textarea
              value={value.azuresql.connectionString}
              onChange={(e) =>
                onChange({ ...value, azuresql: { ...value.azuresql, connectionString: e.target.value } })
              }
              placeholder="Optional: paste a full Azure SQL connection string"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Server</Label>
              <Input
                value={value.azuresql.server}
                onChange={(e) => onChange({ ...value, azuresql: { ...value.azuresql, server: e.target.value } })}
                placeholder="your-server.database.windows.net"
              />
            </div>
            <div className="space-y-2">
              <Label>Database</Label>
              <Input
                value={value.azuresql.database}
                onChange={(e) => onChange({ ...value, azuresql: { ...value.azuresql, database: e.target.value } })}
                placeholder="ScoutingDatabase"
              />
            </div>
            <div className="space-y-2">
              <Label>User</Label>
              <Input
                value={value.azuresql.user}
                onChange={(e) => onChange({ ...value, azuresql: { ...value.azuresql, user: e.target.value } })}
                placeholder="Optional if using managed identity"
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={value.azuresql.password}
                onChange={(e) => onChange({ ...value, azuresql: { ...value.azuresql, password: e.target.value } })}
                placeholder={secretPlaceholder("")}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <div className="flex items-center justify-left gap-2">
                <Label>Managed identity</Label>
                <HelpTooltip side="right">
                  Lets Athena authenticate to your database using your Azure resource's built-in identity instead of a stored password. Recommended if you're hosting on Azure — nothing to rotate or leak.
                </HelpTooltip>
              </div>
              <Select
                value={value.azuresql.useManagedIdentity ? "yes" : "no"}
                onValueChange={(v) =>
                  onChange({ ...value, azuresql: { ...value.azuresql, useManagedIdentity: v === "yes" } })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Enabled</SelectItem>
                  <SelectItem value="no">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {value.provider === "firebase" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Service account path</Label>
            <Input
              value={value.firebase.serviceAccountPath}
              onChange={(e) =>
                onChange({ ...value, firebase: { ...value.firebase, serviceAccountPath: e.target.value } })
              }
              placeholder="/path/to/service-account.json"
            />
          </div>
          <div className="space-y-2">
            <Label>Database URL</Label>
            <Input
              value={value.firebase.databaseURL}
              onChange={(e) => onChange({ ...value, firebase: { ...value.firebase, databaseURL: e.target.value } })}
              placeholder="https://your-project.firebaseio.com"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Service account JSON</Label>
            <Textarea
              value={value.firebase.serviceAccountJson}
              onChange={(e) =>
                onChange({ ...value, firebase: { ...value.firebase, serviceAccountJson: e.target.value } })
              }
              placeholder={secretPlaceholder("Optional JSON object for inline credentials")}
            />
          </div>
        </div>
      )}

      {value.provider === "cosmos" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Endpoint</Label>
            <Input
              value={value.cosmos.endpoint}
              onChange={(e) => onChange({ ...value, cosmos: { ...value.cosmos, endpoint: e.target.value } })}
              placeholder="https://account.documents.azure.com:443/"
            />
          </div>
          <div className="space-y-2">
            <Label>Key</Label>
            <Input
              type="password"
              value={value.cosmos.key}
              onChange={(e) => onChange({ ...value, cosmos: { ...value.cosmos, key: e.target.value } })}
              placeholder={secretPlaceholder("")}
            />
          </div>
          <div className="space-y-2">
            <Label>Database ID</Label>
            <Input
              value={value.cosmos.databaseId}
              onChange={(e) => onChange({ ...value, cosmos: { ...value.cosmos, databaseId: e.target.value } })}
              placeholder="database name"
            />
          </div>
          <div className="space-y-2">
            <Label>Container ID</Label>
            <Input
              value={value.cosmos.containerId}
              onChange={(e) => onChange({ ...value, cosmos: { ...value.cosmos, containerId: e.target.value } })}
              placeholder="users"
            />
          </div>
        </div>
      )}

      {value.provider === "mariadb" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Connection string</Label>
            <Textarea
              value={value.mariadb.connectionString}
              onChange={(e) =>
                onChange({ ...value, mariadb: { ...value.mariadb, connectionString: e.target.value } })
              }
              placeholder="Optional: full MariaDB connection string"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Host</Label>
              <Input
                value={value.mariadb.host}
                onChange={(e) => onChange({ ...value, mariadb: { ...value.mariadb, host: e.target.value } })}
                placeholder="localhost"
              />
            </div>
            <div className="space-y-2">
              <Label>Port</Label>
              <Input
                value={value.mariadb.port}
                onChange={(e) => onChange({ ...value, mariadb: { ...value.mariadb, port: e.target.value } })}
                placeholder="3306"
              />
            </div>
            <div className="space-y-2">
              <Label>Database</Label>
              <Input
                value={value.mariadb.database}
                onChange={(e) => onChange({ ...value, mariadb: { ...value.mariadb, database: e.target.value } })}
                placeholder="athena"
              />
            </div>
            <div className="space-y-2">
              <Label>User</Label>
              <Input
                value={value.mariadb.user}
                onChange={(e) => onChange({ ...value, mariadb: { ...value.mariadb, user: e.target.value } })}
                placeholder="root"
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={value.mariadb.password}
                onChange={(e) => onChange({ ...value, mariadb: { ...value.mariadb, password: e.target.value } })}
                placeholder={secretPlaceholder("")}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}