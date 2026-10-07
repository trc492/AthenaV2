import type { Metadata } from "next";
import { resolveGuestEventLink } from "@/lib/server/guest-link-service";
import { GuestSignIn } from "./guest-sign-in";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Guest Event Access",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function GuestEventPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const grant = await resolveGuestEventLink(token);
  if (!grant) return <main className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-bold">Guest link unavailable</h1><p className="mt-3 text-muted-foreground">This link is invalid or has expired. Ask the event organizer for a new link.</p></main>;
  return <GuestSignIn token={token} name={grant.name} />;
}
