"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  KeyRound,
  Loader2,
  Save,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

// ─── Types ────────────────────────────────────────────────────────────────────

type KeyStatus = {
  configured: boolean;
  source: "env" | "persisted" | "none";
};

type ApiKeyStatusResponse = {
  status: {
    tbaApiKey: KeyStatus;
    ftcApiKey: KeyStatus;
    nexusApiKey: KeyStatus;
  };
};

interface FieldConfig {
  id: keyof ApiKeyStatusResponse["status"];
  label: string;
  placeholder: string;
  description: string;
  isUrl?: boolean;
}

const FIELDS: FieldConfig[] = [
  {
    id: "tbaApiKey",
    label: "The Blue Alliance API Key",
    placeholder: "Paste your TBA API key…",
    description: "Used to fetch FRC event and match data from thebluealliance.com",
  },
  {
    id: "ftcApiKey",
    label: "FTC Events API Key",
    placeholder: "Paste your FTC API key (Base64)…",
    description: "Used to fetch FTC event data from ftc-api.firstinspires.org",
  },
  {
    id: "nexusApiKey",
    label: "FRC Nexus API Key",
    placeholder: "Paste your Nexus API key…",
    description: "Used to fetch pit-map and event-status data from frc.nexus",
  },
];

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: KeyStatus | undefined }) {
  if (!status) return null;
  if (status.source === "env") {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300"
      >
        <CheckCircle2 className="h-3 w-3" />
        Set via env
      </Badge>
    );
  }
  if (status.configured && status.source === "persisted") {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-300"
      >
        <CheckCircle2 className="h-3 w-3" />
        Configured
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="gap-1 border-muted-foreground/30 bg-muted/50 text-muted-foreground"
    >
      <XCircle className="h-3 w-3" />
      Not set
    </Badge>
  );
}

// ─── Secret input with show/hide toggle ───────────────────────────────────────

function SecretInput({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  isUrl,
  lockedByEnv,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled: boolean;
  isUrl?: boolean;
  lockedByEnv: boolean;
}) {
  const [visible, setVisible] = useState(false);

  if (lockedByEnv) {
    return (
      <div className="flex h-9 items-center rounded-md border border-dashed border-blue-500/40 bg-blue-500/5 px-3 text-sm text-muted-foreground">
        Value is controlled by the environment variable — edit the env to change
        it.
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        id={id}
        type={isUrl || visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="pr-10 font-mono text-sm"
        autoComplete="off"
        spellCheck={false}
      />
      {!isUrl && (
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-2 flex items-center text-muted-foreground transition-colors hover:text-foreground"
          tabIndex={-1}
          aria-label={visible ? "Hide key" : "Show key"}
        >
          {visible ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ApiKeysConfiguration() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [keyStatus, setKeyStatus] =
    useState<ApiKeyStatusResponse["status"] | null>(null);

  // Local form values (empty = don't overwrite)
  const [form, setForm] = useState<Record<string, string>>({
    tbaApiKey: "",
    ftcApiKey: "",
    nexusApiKey: "",
  });

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch("/api/system/api-keys");
        if (!res.ok) throw new Error("Failed to load");
        const data = (await res.json()) as ApiKeyStatusResponse;
        if (!mounted) return;
        setKeyStatus(data.status);
      } catch {
        toast.error("Failed to load API key status");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Only send fields that have been filled in (non-empty)
      const patch: Record<string, string> = {};
      for (const field of FIELDS) {
        if (form[field.id] !== "") {
          patch[field.id] = form[field.id];
        }
      }

      const res = await fetch("/api/system/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      const data = (await res.json()) as
        | ApiKeyStatusResponse
        | { error: string };

      if (!res.ok) {
        throw new Error(
          "error" in data ? data.error : "Failed to save API keys",
        );
      }

      setKeyStatus((data as ApiKeyStatusResponse).status);
      // Clear the form inputs after successful save
      setForm({
        tbaApiKey: "",
        ftcApiKey: "",
        nexusApiKey: "",
      });
      toast.success("API keys saved", {
        description:
          "Keys are now active — no restart required for most clients.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("Failed to save API keys", { description: message });
    } finally {
      setSaving(false);
    }
  };

  const hasAnyInput = FIELDS.some((f) => form[f.id] !== "");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          API Keys
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : (
          <>
            {/* Info banner */}
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-950 dark:text-amber-100">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="space-y-1">
                  <p className="font-medium">Persisted runtime config</p>
                  <p>
                    Keys are stored in{" "}
                    <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">
                      .runtime/api-keys.json
                    </code>
                    and take effect immediately. Environment variables always
                    take priority and cannot be overridden here.
                  </p>
                </div>
              </div>
            </div>

            {/* Key fields */}
            <div className="space-y-5">
              {FIELDS.map((field) => {
                const status = keyStatus?.[field.id];
                const lockedByEnv = status?.source === "env";
                return (
                  <div key={field.id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor={field.id} className="font-medium">
                        {field.label}
                      </Label>
                      <StatusBadge status={status} />
                    </div>
                    <SecretInput
                      id={field.id}
                      value={form[field.id]}
                      onChange={(v) =>
                        setForm((prev) => ({ ...prev, [field.id]: v }))
                      }
                      placeholder={field.placeholder}
                      disabled={saving || lockedByEnv}
                      isUrl={field.isUrl}
                      lockedByEnv={lockedByEnv}
                    />
                    <p className="text-xs text-muted-foreground">
                      {field.description}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Save button */}
            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={saving || !hasAnyInput}
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {saving ? "Saving…" : "Save keys"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
