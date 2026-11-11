"use client";

import { createContext, useContext, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useSidebar } from "@/components/ui/sidebar";

const changeEvent = "athena-onboarding-change";
const memory = new Map<string, string>();

function read(key: string) {
  try { return memory.get(key) ?? localStorage.getItem(key) ?? "{}"; }
  catch { return memory.get(key) ?? "{}"; }
}

function subscribe(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key) memory.delete(event.key);
    else memory.clear();
    listener();
  };
  window.addEventListener(changeEvent, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(changeEvent, listener);
    window.removeEventListener("storage", onStorage);
  };
}

export const tourSteps = [
  { id: "account", target: "account", fallback: "account", title: "Open your profile menu", description: "Click your profile here. This is where you find your account, notifications, and the FRC / FTC switch." },
  { id: "program", target: "program", fallback: "account", title: "Switch FRC and FTC", description: "Choose Switch to FTC or Switch to FRC in your profile menu. This changes your available games and events. Skip this step if you want to keep your current program." },
  { id: "event-open", target: "event", fallback: "event", title: "Open the event selector", description: "Click here to find your seasons and events for the selected program." },
  { id: "season", target: "season", fallback: "event", title: "Choose a season", description: "Open the season list and select a year. If the current year is already right, you can skip this step. Reopen the event selector if you closed it." },
  { id: "event", target: "event-options", fallback: "event", title: "Choose your event", description: "Select an event from this list, including the current event if it is already correct. If the list is empty, skip this step or ask an event manager to add an event." },
  { id: "competition", target: "competition", fallback: "competition", title: "Find your scouting assignment", description: "Expand Competition to see Schedule, Start Pit Scouting, and Start Match Scouting. Click the section to explore its navigation." },
  { id: "settings", target: "settings", fallback: "settings", title: "Find settings and offline tools", description: "Open Settings to finish. You can download offline data and replay this tour from Getting Started & Guided Tour anytime." },
] as const;

type TourId = typeof tourSteps[number]["id"];
type Progress = { dismissed: boolean; completed: string[] };
type OnboardingContextValue = {
  enabled: boolean;
  ready: boolean;
  progress: Progress;
  setCompleted: (id: string, complete: boolean) => void;
  dismiss: () => void;
  restore: () => void;
  startTour: (step?: number) => void;
  stopTour: (finished?: boolean) => void;
  step: number | null;
  setStep: (step: number) => void;
  completedSteps: string[];
  completeAction: (id: TourId) => void;
};
const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const { isMobile, open, openMobile, setOpen, setOpenMobile } = useSidebar();
  const enabled = status === "authenticated" && !!session?.user?.id && !session.guestEvent;
  const key = `athena:onboarding:v1:${session?.user?.id ?? "anonymous"}`;
  const raw = useSyncExternalStore(subscribe, () => read(key), () => "{}");
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  let progress: Progress = { dismissed: false, completed: [] };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const value = parsed as Partial<Progress>;
      progress = { dismissed: value.dismissed === true, completed: Array.isArray(value.completed) ? value.completed.filter((id): id is string => typeof id === "string") : [] };
    }
  } catch { /* Ignore invalid saved progress. */ }
  const [tour, setTour] = useState<{ step: number; pathname: string; key: string; completed: string[] } | null>(null);
  // End a walkthrough on navigation or account changes, so Back cannot revive it.
  if (tour && (tour.pathname !== pathname || tour.key !== key)) setTour(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const previousOpen = useRef(true);
  const step = enabled && tour?.key === key && tour.pathname === pathname && (isMobile ? openMobile : open) ? tour.step : null;

  function save(next: Progress) {
    if (!enabled) return;
    const value = JSON.stringify(next);
    memory.set(key, value);
    try { localStorage.setItem(key, value); } catch { /* Keep progress for this session when storage is unavailable. */ }
    window.dispatchEvent(new Event(changeEvent));
  }

  function startTour(nextStep = 0) {
    if (!enabled) return;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    previousOpen.current = open;
    setOpen(true);
    if (isMobile) setOpenMobile(true);
    setTour({ step: Math.max(0, Math.min(tourSteps.length - 1, nextStep)), pathname, key, completed: [] });
  }

  function stopTour(finished = false) {
    if (finished) save({ ...progress, completed: [...new Set([...progress.completed, "tour"])] });
    setTour(null);
    if (isMobile) setOpenMobile(false);
    setOpen(previousOpen.current);
    requestAnimationFrame(() => returnFocus.current?.focus());
  }

  return <OnboardingContext.Provider value={{
    enabled, ready, progress, step, startTour, stopTour,
    completedSteps: tour?.completed ?? [],
    completeAction: (id) => {
      if (step === null || !tour || tourSteps[step].id !== id) return;
      if (step === tourSteps.length - 1) { stopTour(true); return; }
      setTour({ ...tour, step: step + 1, completed: [...new Set([...tour.completed, id])] });
    },
    setStep: (next) => setTour({ step: Math.max(0, Math.min(tourSteps.length - 1, next)), pathname, key, completed: tour?.completed ?? [] }),
    setCompleted: (id, complete) => save({ ...progress, completed: complete ? [...new Set([...progress.completed, id])] : progress.completed.filter((item) => item !== id) }),
    dismiss: () => save({ ...progress, dismissed: true }),
    restore: () => save({ ...progress, dismissed: false }),
  }}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) throw new Error("Onboarding requires OnboardingProvider");
  return context;
}

export function useTourHighlight(id: TourId) {
  const { step } = useOnboarding();
  return step !== null && tourSteps[step].id === id ? "ring-2 ring-primary ring-offset-2 ring-offset-sidebar" : "";
}
