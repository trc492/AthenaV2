"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { useActivePolling } from "@/hooks/use-active-polling";

export function GuestAccessBoundary({ children }: { children: React.ReactNode }) {
  const { data: session, update } = useSession();
  const expiry = session?.guestEvent?.expiresAt;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiry) return;
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, [expiry]);
  useActivePolling(() => { void update().catch(console.error); }, 30_000, !!expiry && now < expiry);
  if (expiry && now >= expiry) return <main className="mx-auto max-w-xl space-y-4 p-8"><h1 className="text-2xl font-bold">Guest access expired</h1><p>Ask the event organizer for a new link.</p><Button onClick={() => signOut({ callbackUrl: "/login" })}>Leave guest access</Button></main>;
  return children;
}
