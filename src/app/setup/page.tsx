import { redirect } from "next/navigation";
import { checkSetupStatus } from "@/lib/server/setup";
import { FirstRunSetupPage } from "@/components/landing-page/first-run/first-run-setup-page";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const status = await checkSetupStatus();

  if (status.isComplete) {
    redirect("/login");
  }

  const initialStep = status.needsAppUrl
    ? "app-url"
    : status.needsDatabase
      ? "database"
      : "admin";

  return <FirstRunSetupPage initialStep={initialStep} />;
}
