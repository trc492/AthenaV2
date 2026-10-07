"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function GuestSignIn({ token, name }: { token: string; name: string }) {
  const started = useRef(false);
  const [error, setError] = useState(false);
  const enter = useCallback(async () => {
    setError(false);
    try {
      const result = await signIn("credentials", { guestToken: token, redirect: false });
      if (result?.error) throw new Error(result.error);
      // Clear the previous account's in-memory router and query state.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/dashboard");
    } catch { setError(true); }
  }, [token]);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void enter();
  }, [enter]);
  return <main className="mx-auto max-w-xl space-y-4 p-8"><h1 className="text-2xl font-bold">{name}</h1><p>{error ? "Unable to open guest access. Please try again." : "Opening the event website with read-only guest access…"}</p>{error && <Button onClick={enter}>Try again</Button>}</main>;
}
