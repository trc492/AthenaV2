import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BarChart3, CalendarDays, Check, ClipboardList, Heart, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_LOGO, APP_LOGO_DARK, APP_NAME, ORGANIZATION_URL } from "@/lib/app-config";
import { DashboardPreview, SchedulePreview, PitPreview, MatchPreview, AnalyticsPreview } from "./product-previews";

export const features = [
  { id: "scheduling", label: "Scheduling", title: "Give each scout a clear assignment.", description: "Build scouting rotations and assign scouts to each match. Everyone can check the same schedule and see where they need to be.", points: ["Match-by-match assignments", "One shared schedule for your team"], preview: SchedulePreview },
  { id: "pit-scouting", label: "Pit scouting", title: "Keep robot details with your pit notes.", description: "Record robot capabilities, build details, and notes from pit visits. Keep that context available when your team reviews match results.", points: ["Structured robot profiles", "Capabilities and notes in one place"], preview: PitPreview },
  { id: "match-scouting", label: "Match scouting", title: "Record what happens on the field.", description: "Collect match data from the stands. If the venue connection drops, keep scouting offline and sync your entries when you reconnect.", points: ["Fast match data collection", "Offline support for competition day"], preview: MatchPreview },
  { id: "analytics", label: "Analysis", title: "Compare teams before making your picks.", description: "Review team performance, look for trends across matches, and use your scouting data to prepare for alliance selection.", points: ["Team comparisons and performance trends", "Insights for alliance preparation"], preview: AnalyticsPreview },
];

export function NotLoggedInLandingPage({ signupEnabled }: { signupEnabled: boolean }) {
  const destination = signupEnabled ? "/signup" : "/login";
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6 lg:px-8">
          <Link href="/" aria-label={`${APP_NAME} home`} className="flex items-center gap-2.5 text-lg font-bold tracking-tight">
            <Image src={APP_LOGO} alt="" width={34} height={34} className="dark:hidden" />
            <Image src={APP_LOGO_DARK} alt="" width={34} height={34} className="hidden dark:block" />
            {APP_NAME}
          </Link>
          <div className="flex items-center gap-2">
            {signupEnabled && <Button asChild variant="ghost" className="hidden h-11 sm:inline-flex md:h-9"><Link href="/login">Log in</Link></Button>}
            <Button asChild className="h-11 md:h-9"><Link href={destination}>{signupEnabled ? "Create an account" : "Log in"}<ArrowRight aria-hidden="true" /></Link></Button>
          </div>
        </div>
      </header>
      <main>
        <section className="border-b">
          <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-6 py-12 lg:px-8 sm:py-16 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12">
            <div>
              <p className="mb-4 text-sm font-medium text-muted-foreground">Built by students for FIRST teams</p>
              <h1 className="max-w-lg font-heading text-3xl leading-tight font-bold tracking-tight sm:text-4xl">Your team’s scouting, in one place.</h1>
              <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">Use {APP_NAME} to organize scouting assignments, collect pit and match data, and compare teams throughout an event.</p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Button asChild size="lg" className="h-11 md:h-10"><Link href={destination}>{signupEnabled ? "Create an account" : "Log in"}<ArrowRight aria-hidden="true" /></Link></Button>
                <Button asChild variant="outline" size="lg" className="h-11 md:h-10"><a href="#features">View scouting tools</a></Button>
              </div>
              {!signupEnabled && <p className="mt-4 text-sm text-muted-foreground">Need an account? Contact your team administrator.</p>}
              <p className="mt-6 text-sm text-muted-foreground">Pit and match scouting work offline, too.</p>
            </div>
            <DashboardPreview />
          </div>
        </section>
        <nav id="features" aria-label="Scouting tools" className="scroll-mt-24 border-b">
          <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8 sm:grid-cols-2 lg:px-8 lg:grid-cols-4">
            {[{ icon: CalendarDays, title: "Scheduling", text: "Scout assignments for each match", href: "scheduling" }, { icon: Users, title: "Pit scouting", text: "Robot capabilities and pit notes", href: "pit-scouting" }, { icon: ClipboardList, title: "Match scouting", text: "Match entries with offline support", href: "match-scouting" }, { icon: BarChart3, title: "Analysis", text: "Team comparisons and trends", href: "analytics" }].map(({ icon: Icon, title, text, href }) => <a key={href} href={`#${href}`} className="flex min-h-11 items-start gap-3 rounded-lg p-2 transition-colors hover:bg-muted"><Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" /><div><div className="text-sm font-semibold">{title}</div><p className="mt-1 text-xs text-muted-foreground">{text}</p></div></a>)}
          </div>
        </nav>
        <div className="mx-auto grid max-w-7xl gap-x-12 px-6 sm:grid-cols-2 lg:px-8">
          {features.map(({ id, label, title, description, points, preview: Preview }, index) => <section key={id} id={id} className={`grid scroll-mt-24 gap-8 border-b py-12 sm:py-16 ${index < 2 ? "content-start" : "sm:col-span-2 lg:grid-cols-[0.75fr_1.25fr] lg:items-center lg:gap-12"}`}>
            <div>
              <p className="mb-3 text-sm font-medium text-muted-foreground">{label}</p>
              <h2 className="max-w-md font-heading text-2xl leading-tight font-semibold tracking-tight">{title}</h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
              <ul className="mt-4 space-y-2">{points.map(point => <li key={point} className="flex items-center gap-2.5 text-sm"><Check aria-hidden="true" className="size-4 shrink-0 text-primary" />{point}</li>)}</ul>
            </div>
            <div className="min-w-0"><Preview /></div>
          </section>)}
        </div>
        <section className="border-t bg-muted/50">
          <div className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between lg:px-8">
            <div>
              <h2 className="font-heading text-2xl leading-tight font-semibold tracking-tight">{signupEnabled ? "Set up your scouting workspace." : "Open your team’s workspace."}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{signupEnabled ? "Create an account to start organizing your team’s scouting." : "Need an account? Contact your team administrator."}</p>
            </div>
            <Button asChild size="lg" className="h-11 md:h-10"><Link href={destination}>{signupEnabled ? "Create an account" : `Log in to ${APP_NAME}`}<ArrowRight aria-hidden="true" /></Link></Button>
          </div>
        </section>
      </main>
      <footer className="relative z-10 w-full mt-auto border-t bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="text-center text-sm text-muted-foreground">
            <span>
              {APP_NAME} &middot; Made with 
              <Heart className="inline-block h-4 w-4 mx-1 text-green-500" />
              {" by "}
              <a
                href={ORGANIZATION_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-primary transition-colors"
              >Titan Robotics Club</a>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
