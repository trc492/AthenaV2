"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Bell, ChevronRight, Compass, Info, Layers, Search, UserRound, type LucideIcon } from "lucide-react";
import { useAccountSettingsDialog, useNotificationSettingsDialog } from "@/app/dashboard/dashboard-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAdministrationSettings } from "@/components/settings/settings-navigation";

type Setting = { title: string; description: string; icon: LucideIcon; href?: string; onClick?: () => void };

export function SettingsDirectory() {
  const [query, setQuery] = useState("");
  const { openAccountSettings } = useAccountSettingsDialog();
  const { openNotificationSettings } = useNotificationSettingsDialog();
  const administration = useAdministrationSettings();
  const groups: { title: string; items: Setting[] }[] = [
    { title: "Personal", items: [
      { title: "Account", description: "Profile, username, photo, password, and preferred scouting partners.", icon: UserRound, onClick: openAccountSettings },
      { title: "Notification Preferences", description: "Choose your notifications and manage device permissions.", icon: Bell, onClick: openNotificationSettings },
    ] },
    { title: "Device & App", items: [
      { title: "Getting Started & Guided Tour", description: "Reopen onboarding and learn to switch FRC / FTC programs, seasons, and events.", icon: Compass, href: "#getting-started" },
      { title: "Offline Data Cache", description: "Download event data to keep scouting without an internet connection.", icon: Layers, href: "#offline-data" },
      { title: "About Athena V2", description: "App version, features, and supported games.", icon: Info, href: "#about-athena" },
    ] },
    { title: "Administration", items: administration },
  ];
  const terms = query.trim().toLowerCase().split(/\s+/);
  const filtered = groups.map((group) => ({ ...group, items: group.items.filter((item) => terms.every((term) => `${group.title} ${item.title} ${item.description}`.toLowerCase().includes(term))) })).filter((group) => group.items.length > 0);
  const count = filtered.reduce((total, group) => total + group.items.length, 0);
  const cardClass = "group flex w-full items-start gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring";

  return (
    <section aria-label="Find settings" className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="relative w-full max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" aria-hidden="true" />
          <Input type="search" aria-label="Search settings" placeholder="Search settings, e.g. password, backups, API keys..." value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 pl-9" />
        </div>
        {query && <Button variant="ghost" onClick={() => setQuery("")}>Clear</Button>}
      </div>
      <p className="sr-only" role="status">{count} settings found</p>
      {filtered.map((group) => (
        <div key={group.title} className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">{group.title}</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {group.items.map(({ title, description, icon: Icon, href, onClick }) => {
              const content = <>
                <span className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="size-5" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1"><span className="block font-medium">{title}</span><span className="mt-1 block text-sm text-muted-foreground">{description}</span></span>
                {onClick ? <ArrowUpRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
              </>;
              return href ? <Link key={title} href={href} className={cardClass}>{content}</Link> : <button key={title} type="button" onClick={onClick} aria-haspopup="dialog" className={cardClass}>{content}</button>;
            })}
          </div>
        </div>
      ))}
      {count === 0 && <div className="rounded-xl border border-dashed p-8 text-center"><p className="font-medium">No settings found</p><p className="mt-1 text-sm text-muted-foreground">Try a different name or keyword, such as account or offline.</p></div>}
    </section>
  );
}
