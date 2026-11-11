"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { CheckCircle2, Circle, Compass } from "lucide-react";
import { useAccountSettingsDialog, useNotificationSettingsDialog } from "@/app/dashboard/dashboard-shell";
import { useEventConfig } from "@/hooks/use-event-config";
import { useGameConfig } from "@/hooks/use-game-config";
import { hasPermission, PERMISSIONS, ROLES } from "@/lib/auth/roles";
import { indexedDBService } from "@/lib/indexeddb-service";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useOnboarding } from "./onboarding-provider";

type Task = { id: string; title: string; detail: string; href?: string; action?: () => void; automatic?: boolean; done?: boolean };

export function OnboardingChecklist({ settings = false }: { settings?: boolean }) {
  const { enabled, ready, progress, setCompleted, dismiss, restore, startTour } = useOnboarding();
  const { data: session } = useSession();
  const { selectedEvent } = useEventConfig();
  const { competitionType, currentYear } = useGameConfig();
  const { openAccountSettings } = useAccountSettingsDialog();
  const { openNotificationSettings } = useNotificationSettingsDialog();
  const pathname = usePathname();
  const eventCode = selectedEvent?.eventCode;
  const scope = `${competitionType}:${currentYear}:${eventCode ?? ""}`;
  const [cached, setCached] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !eventCode) return;
    let cancelled = false;
    const refresh = () => {
      void indexedDBService.getEventCacheStatus({ eventCode, competitionType, year: currentYear })
        .catch(() => null).then((status) => {
          if (!cancelled) setCached(status?.pagesCached && status.sessionCached && status.schedulesCached ? scope : null);
        });
    };
    refresh();
    window.addEventListener("focus", refresh);
    const interval = window.setInterval(refresh, 10000);
    return () => { cancelled = true; window.removeEventListener("focus", refresh); window.clearInterval(interval); };
  }, [enabled, eventCode, competitionType, currentYear, scope, pathname]);

  if (!enabled || !ready || (!settings && progress.dismissed)) return null;
  const role = session?.user?.role ?? null;
  const canScout = hasPermission(role, PERMISSIONS.CREATE_MATCH_SCOUTING);
  const tasks: Task[] = [
    { id: "tour", title: "Learn your way around", detail: "Find the program switch, event selector, and scouting tools.", action: () => startTour(), automatic: true, done: progress.completed.includes("tour") },
    { id: "event", title: "Choose your program, season, and event", detail: selectedEvent ? `${competitionType} ${currentYear} · ${selectedEvent.name}` : "Switch FRC / FTC in your profile menu, then open the event selector.", action: () => startTour(), automatic: true, done: !!selectedEvent },
    { id: "profile", title: "Review your profile", detail: "Check your name, photo, password, and scouting partners.", action: openAccountSettings },
    { id: "notifications", title: "Review notification preferences", detail: "Enable alerts if you want them and your device supports them.", action: openNotificationSettings },
    { id: `offline:${scope}`, title: "Download offline data", detail: "Cache this event on this device before heading to the field.", href: "/dashboard/settings#offline-data", automatic: true, done: !!eventCode && cached === scope },
  ];
  if (canScout) tasks.push({ id: `schedule:${scope}`, title: "Find your assignment", detail: "Check when and where you are scheduled to scout.", href: "/dashboard/schedule" });
  if (role === ROLES.ADMIN || role === ROLES.LEAD_SCOUT) tasks.push({ id: "team", title: "Review your team", detail: "Check scout accounts and team responsibilities.", href: "/dashboard/admin/team" });
  if (hasPermission(role, PERMISSIONS.MANAGE_SYSTEM_CONFIG)) tasks.push(
    { id: "game", title: "Review the season configuration", detail: "Check the scouting forms and metrics for your game.", href: "/dashboard/admin/game-config" },
    { id: "integrations", title: "Review integrations", detail: "Connect the external services your team uses, if needed.", href: "/dashboard/admin/keys" },
  );
  const isDone = (task: Task) => task.automatic ? !!task.done : progress.completed.includes(task.id);
  const count = tasks.filter(isDone).length;
  if (!settings && count === tasks.length) return null;

  return (
    <section id="getting-started" aria-labelledby="getting-started-heading" className="scroll-mt-6 space-y-4 rounded-xl border border-primary/25 bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 id="getting-started-heading" className="flex items-center gap-2 text-lg font-semibold"><Compass className="size-5 text-primary" aria-hidden="true" />{canScout ? "Get ready to scout" : "Get started with Athena"}</h2><p className="mt-1 text-sm text-muted-foreground">A quick setup checklist. Check off reviews when you’re done; event and download status update automatically.</p></div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => startTour()}>Take a guided tour</Button>
          {settings ? <Button size="sm" variant="outline" onClick={progress.dismissed ? restore : dismiss}>{progress.dismissed ? "Show on dashboard" : "Hide from dashboard"}</Button> : <Button size="sm" variant="ghost" onClick={dismiss}>Dismiss checklist</Button>}
        </div>
      </div>
      <div className="space-y-2"><p className="text-xs text-muted-foreground" role="status">{count} of {tasks.length} complete · Saved for your account on this device</p><Progress value={count / tasks.length * 100} aria-label="Getting started progress" /></div>
      <ul className="grid gap-3 lg:grid-cols-2">
        {tasks.map((task) => <li key={task.id} className="flex items-start gap-3 rounded-lg border p-3">
          {task.automatic ? <span className="mt-1">{isDone(task) ? <CheckCircle2 className="size-4 text-primary" aria-label="Complete" /> : <Circle className="size-4 text-muted-foreground" aria-label="Incomplete" />}</span> : <Checkbox className="mt-1" aria-label={`Mark ${task.title.toLowerCase()} complete`} checked={isDone(task)} onCheckedChange={(checked) => setCompleted(task.id, checked === true)} />}
          <div className="min-w-0 flex-1">
            {task.href ? <Link href={task.href} className="rounded-sm text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">{task.title}</Link> : <button type="button" onClick={task.action} className="rounded-sm text-left text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">{task.title}</button>}
            <p className="mt-1 text-xs text-muted-foreground">{task.detail}</p>
          </div>
        </li>)}
      </ul>
    </section>
  );
}
