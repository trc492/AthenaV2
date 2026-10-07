"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import { useSelectedEvent } from "@/hooks/use-event-config";
import { GuestEventLink } from "./guest-event-link";
import { useGameConfig } from "@/hooks/use-game-config";
import type { GuestLinkRecord } from "@/lib/types";
import { useAsyncData } from "@/hooks/use-async-data";

type ActiveLink = Omit<GuestLinkRecord, "token"> & { path: string };

export function GuestLinksManager() {
  const event = useSelectedEvent();
  const { currentYear, competitionType } = useGameConfig();
  const [revokedIds, setRevokedIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<ActiveLink | null>(null);
  const [revoking, setRevoking] = useState(false);
  const { data, loading, error: loadError, reload: refresh } = useAsyncData<{ links: ActiveLink[]; origin: string }>("guest-links", async () => {
      const response = await fetch("/api/events/guest-links", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load guest links");
      return { links: data.links, origin: window.location.origin };
  });
  const links = (data?.links ?? []).filter((link) => !revokedIds.includes(link.id));
  const origin = data?.origin ?? "";
  const error = loadError instanceof Error ? loadError.message : loadError ? "Unable to load guest links" : "";

  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), 30000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function revoke() {
    if (!pending) return;
    setRevoking(true);
    setMessage("");
    try {
      const response = await fetch(`/api/events/guest-links?id=${pending.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to revoke link");
      setRevokedIds((current) => [...current, pending.id]);
      refresh();
      setPending(null);
      setMessage("Guest access revoked. This link no longer works for new or existing guest sessions.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to revoke link"); }
    finally { setRevoking(false); }
  }

  async function copy(link: ActiveLink) {
    try { await navigator.clipboard.writeText(`${origin}${link.path}`); setMessage("Guest link copied"); }
    catch { setMessage("Select and copy the link from its text field."); }
  }

  return <div className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-3xl font-bold tracking-tight">Guest Links</h1><p className="text-muted-foreground">Manage active guest access across all events.</p></div><Button variant="outline" onClick={() => void refresh()}>Refresh</Button></header>
    {event && <Card><CardHeader><CardTitle>Share {event.name}</CardTitle><CardDescription>Create a read-only link for the selected event.</CardDescription></CardHeader><CardContent><GuestEventLink key={`${competitionType}:${currentYear}:${event.eventCode}`} event={event} onCreated={refresh} /></CardContent></Card>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {message && <p role="status" className="text-sm">{message}</p>}
    <div className="flex items-center gap-2"><h2 className="text-xl font-semibold">Active links</h2><Badge variant="secondary">{links.length}</Badge></div>
    {loading && !data ? <p>Loading guest links...</p> : !loading && !links.length && !error ? <Card><CardContent className="py-8 text-center text-muted-foreground">No active guest links. Select an event and create a link above.</CardContent></Card> : null}
    <div className="grid gap-4 lg:grid-cols-2">{links.map((link) => <Card key={link.id}>
      <CardHeader><CardTitle>{link.name}</CardTitle><CardDescription>{link.competitionType} {link.year} · {link.eventCode}</CardDescription></CardHeader>
      <CardContent className="space-y-3"><dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-muted-foreground">Created</dt><dd>{new Date(link.createdAt).toLocaleString()}</dd></div><div><dt className="text-muted-foreground">Expires</dt><dd>{new Date(link.expiresAt).toLocaleString()}</dd></div></dl>
        <Input aria-label={`Guest link for ${link.name}`} readOnly value={`${origin}${link.path}`} onFocus={(event) => event.target.select()} />
        <div className="flex gap-2"><Button variant="outline" onClick={() => copy(link)}>Copy link</Button><Button variant="destructive" onClick={() => setPending(link)}>Revoke access</Button></div>
      </CardContent></Card>)}</div>
    <DeleteConfirmationDialog open={!!pending} onOpenChange={(open) => { if (!open && !revoking) setPending(null); }} onConfirm={revoke} title="Revoke guest access?" description={`Anyone using this link for ${pending?.name ?? "this event"} will lose access. This cannot be undone; you can create a new link.`} loading={revoking} confirmButtonText="Revoke access" loadingText="Revoking..." />
  </div>;
}
