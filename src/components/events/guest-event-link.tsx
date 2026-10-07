"use client";

import { useState } from "react";
import { useGameConfig } from "@/hooks/use-game-config";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { PERMISSIONS } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Event } from "@/lib/types";
import Link from "next/link";

export function GuestEventLink({ event, onCreated }: { event: Event; onCreated?: () => void | Promise<void> }) {
  const { currentYear, competitionType } = useGameConfig();
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function createLink() {
    setBusy(true);
    setMessage("");
    setLink("");
    try {
      const response = await fetch("/api/events/guest-links", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...event, year: currentYear, competitionType }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create link");
      setLink(new URL(data.path, window.location.origin).href);
      await onCreated?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create link");
    } finally { setBusy(false); }
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(link); setMessage("Link copied"); }
    catch { setMessage("Select and copy the link below."); }
  }
  return <PermissionGuard permission={PERMISSIONS.MANAGE_EVENT_SETTINGS}>
    <div className="space-y-2 border-t pt-3">
      <Button variant="outline" size="sm" disabled={busy} onClick={createLink}>{busy ? "Creating…" : "Create guest viewer link"}</Button>
      {!onCreated && <Button asChild variant="ghost" size="sm"><Link href="/dashboard/guest-links">Manage guest links</Link></Button>}
      <p className="text-xs text-muted-foreground">Anyone with the link can browse this event’s website in read-only mode for 7 days. Picklists, comments, scout identities, and administration are hidden.</p>
      {link && <div className="flex gap-2"><Input aria-label="Guest viewer link" readOnly value={link} onFocus={(event) => event.target.select()} /><Button variant="outline" onClick={copyLink}>Copy</Button></div>}
      {message && <p role="status" className="text-sm">{message}</p>}
    </div>
  </PermissionGuard>;
}
