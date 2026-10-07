"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function GuestAccessBoundary({ children }: { children: React.ReactNode }) {
  const { data: session, update } = useSession();
  const expiry = session?.guestEvent?.expiresAt;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiry) return;
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, [expiry]);
  useEffect(() => {
    if (!expiry) return;
    const refreshAccess = () => { void update(); };
    const timer = window.setInterval(refreshAccess, 30000);
    window.addEventListener("focus", refreshAccess);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refreshAccess); };
  }, [expiry, update]);
  if (expiry && now >= expiry) return <main className="mx-auto max-w-xl space-y-4 p-8"><h1 className="text-2xl font-bold">Guest access expired</h1><p>Ask the event organizer for a new link.</p><Button onClick={() => signOut({ callbackUrl: "/login" })}>Leave guest access</Button></main>;
  return children;
}
