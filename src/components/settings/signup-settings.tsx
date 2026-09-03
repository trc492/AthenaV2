"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function SignupSettings() {
  const [signupEnabled, setSignupEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch("/api/system/settings");
        if (!res.ok) throw new Error("Failed to fetch settings");
        const data = await res.json();
        setSignupEnabled(data.settings.signupEnabled);
      } catch (err) {
        console.error("Error fetching system settings:", err);
        toast.error("Failed to load system settings");
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const handleToggle = async (checked: boolean) => {
    setSaving(true);
    try {
      const res = await fetch("/api/system/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signupEnabled: checked }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update setting");
      }
      const data = await res.json();
      setSignupEnabled(data.settings.signupEnabled);
      toast.success(
        data.settings.signupEnabled
          ? "Public sign-up enabled"
          : "Public sign-up disabled",
        {
          description: data.settings.signupEnabled
            ? "New users can now register via the sign-up page."
            : "The sign-up page is now disabled. Users must be created by an admin.",
        },
      );
    } catch (err) {
      console.error("Error updating system settings:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to update setting",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Sign-Up Settings
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label
                htmlFor="signup-toggle"
                className="text-base font-medium cursor-pointer"
              >
                Allow Public Sign-Up
              </Label>
              <p className="text-sm text-muted-foreground">
                {signupEnabled
                  ? "The /signup page is publicly accessible. Anyone can create an account."
                  : "The /signup page is disabled. Only admins can create new accounts."}
              </p>
            </div>
            <Switch
              id="signup-toggle"
              checked={signupEnabled}
              onCheckedChange={handleToggle}
              disabled={saving}
              aria-label="Toggle public sign-up"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
