"use client";

import { SessionProvider as NextAuthSessionProvider, useSession } from "next-auth/react";
import { useActivePolling } from "@/hooks/use-active-polling";

function ActiveSessionRefresh() {
  const { data: session, status, update } = useSession();
  useActivePolling(
    () => { void update().catch(console.error); },
    5 * 60_000,
    status === "authenticated" && !session?.guestEvent,
  );
  return null;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider
      refetchInterval={0} // ActiveSessionRefresh handles activity-aware refreshes.
      refetchOnWindowFocus={false} // Disable refetch on window focus to avoid issues when offline
      refetchWhenOffline={false} // Disable refetch when offline (if supported)
    >
      <ActiveSessionRefresh />
      {children}
    </NextAuthSessionProvider>
  );
}
