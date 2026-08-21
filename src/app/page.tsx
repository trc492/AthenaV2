import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { checkSetupStatus } from "@/lib/server/setup";
import { LoggedInLandingPage } from "@/components/landing-page/logged-in-landing-page";
import { NotLoggedInLandingPage } from "@/components/landing-page/not-logged-in-landing-page";

export const dynamic = "force-dynamic";

export default async function Page() {
  const status = await checkSetupStatus();
  if (!status.isComplete) {
    redirect("/setup");
  }

  const session = await auth();

  return session ? <LoggedInLandingPage /> : <NotLoggedInLandingPage />;
}