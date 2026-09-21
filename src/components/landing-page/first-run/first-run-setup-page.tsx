"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Check,
  PartyPopper,
  ArrowRight,
  Database as DatabaseIcon,
  UserPlus,
  Rocket,
  KeyRound,
  Globe,
  AlertCircle,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModeToggle } from "@/components/ui/light-dark-toggle";
import { ThemeSelector } from "@/components/settings/theme-selector";
import { APP_LOGO, APP_LOGO_DARK } from "@/lib/app-config";
import { DatabaseStep } from "./database-setup";
import { AdminStep } from "./admin-setup";
import {
  type DatabaseFormState,
  type AdminFormValues,
  type SetupResult,
  type SetupStep,
  defaultDatabaseFormState,
} from "./types";

interface FirstRunSetupPageProps {
  appName?: string;
  redirectHref?: string;
  initialStep?: SetupStep;
  stepAfterAppUrl?: Exclude<SetupStep, "app-url">;
  onSubmitAppUrl?: (appUrl: string) => Promise<SetupResult>;
  onSubmitDatabase?: (data: DatabaseFormState) => Promise<SetupResult>;
  onSubmitAdmin?: (data: AdminFormValues) => Promise<SetupResult>;
}

const defaultSubmitAppUrl = async (appUrl: string): Promise<SetupResult> => {
  try {
    const res = await fetch("/api/setup/app-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appUrl }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: body?.error ?? "Couldn't save the app URL. Please try again.",
      };
    }
    return { success: true };
  } catch {
    return {
      success: false,
      error: "Couldn't reach the server. Check your connection and try again.",
    };
  }
};

const defaultSubmitDatabase = async (
  data: DatabaseFormState,
): Promise<SetupResult> => {
  try {
    const res = await fetch("/api/setup/database", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: body?.error ?? "We couldn't connect to that database. Double-check your details and try again.",
      };
    }
    return {
      success: true,
      setupComplete: Boolean(body?.setupComplete ?? body?.adminExists ?? false),
    };
  } catch {
    return {
      success: false,
      error: "We couldn't reach the server. Check your connection and try again.",
    };
  }
};

const defaultSubmitAdmin = async (
  data: AdminFormValues,
): Promise<SetupResult> => {
  try {
    const res = await fetch("/api/setup/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: body?.error ?? "Something went wrong creating your account. Please try again.",
      };
    }
    return { success: true };
  } catch {
    return {
      success: false,
      error: "We couldn't reach the server. Check your connection and try again.",
    };
  }
};

const STEPS: { key: SetupStep; label: string; icon: typeof DatabaseIcon }[] = [
  { key: "app-url", label: "App URL", icon: Globe },
  { key: "database", label: "Database", icon: DatabaseIcon },
  { key: "admin", label: "Admin account", icon: UserPlus },
];

const WELCOME_STEPS = [
  { key: "app-url" as const, label: "Set your app URL", icon: Globe },
  { key: "database" as const, label: "Connect your database", icon: DatabaseIcon },
  { key: "admin" as const, label: "Create your admin account", icon: UserPlus },
  { key: "complete" as const, label: "Start scouting", icon: Rocket },
];

function WelcomePanel({
  appName,
  current,
}: {
  appName: string;
  current: SetupStep;
}) {
  const currentIndex = WELCOME_STEPS.findIndex((s) => s.key === current);

  return (
    <div className="hidden lg:block">
      <h1 className="text-3xl font-bold tracking-tight mb-2">
        Welcome to {appName}
      </h1>
      <p className="text-muted-foreground mb-8 max-w-sm">
        Let's get your scouting platform up and running — it only takes
        a couple of minutes.
      </p>
      <ul className="space-y-4">
        {WELCOME_STEPS.map((item, i) => {
          const isDone = currentIndex !== -1 && i < currentIndex;
          const isActive = item.key === current;
          const Icon = item.icon;

          return (
            <li key={item.key} className="flex items-center gap-3">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-300 ${
                  isDone
                    ? "bg-primary border-primary text-primary-foreground"
                    : isActive
                      ? "border-primary text-primary"
                      : "border-muted text-muted-foreground"
                }`}
              >
                {isDone ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
              </div>
              <span
                className={`text-sm ${
                  isActive
                    ? "text-foreground font-medium"
                    : isDone
                      ? "text-foreground"
                      : "text-muted-foreground"
                }`}
              >
                {item.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StepIndicator({ current }: { current: SetupStep }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);

  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((step, i) => {
        const isDone = (current as string) === "complete" || (currentIndex !== -1 && i < currentIndex);
        const isActive = step.key === current;
        const Icon = step.icon;

        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors duration-300 ${
                  isDone
                    ? "bg-primary border-primary text-primary-foreground"
                    : isActive
                      ? "border-primary text-primary"
                      : "border-muted text-muted-foreground"
                }`}
              >
                {isDone ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <span
                className={`text-xs ${
                  isActive
                    ? "text-foreground font-medium"
                    : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-0.5 w-12 sm:w-20 mx-2 transition-colors duration-300 ${
                  isDone ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// App URL step
// ---------------------------------------------------------------------------

interface AppUrlStepProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  error: string | null;
}

function AppUrlStep({ value, onChange, onSubmit, isSubmitting, error }: AppUrlStepProps) {
  return (
    <Card className="shadow-lg">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl">Set your app URL</CardTitle>
        <CardDescription>
          Enter the public address where this app is accessible. This is used
          by the authentication system for sign-in redirects, so it needs to
          match the URL users actually visit — including any custom domain or
          port your reverse proxy exposes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="appUrl">App URL</Label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              id="appUrl"
              type="url"
              placeholder="https://scouting.myteam.com"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="pl-9"
              onKeyDown={(e) => {
                if (e.key === "Enter" && value.trim()) onSubmit();
              }}
              disabled={isSubmitting}
              autoFocus
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Use the full URL including the protocol, e.g.{" "}
            <code className="font-mono bg-muted px-1 rounded">https://scouting.myteam.com</code>{" "}
            or{" "}
            <code className="font-mono bg-muted px-1 rounded">http://192.168.1.10:8080</code>.
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          onClick={onSubmit}
          disabled={isSubmitting || !value.trim()}
        >
          {isSubmitting ? "Saving…" : "Continue"}
          {!isSubmitting && <ArrowRight className="h-4 w-4 ml-2" />}
        </Button>
      </CardFooter>
    </Card>
  );
}

export function FirstRunSetupPage({
  appName = "Athena",
  redirectHref = "/login",
  initialStep = "app-url",
  stepAfterAppUrl = "database",
  onSubmitAppUrl = defaultSubmitAppUrl,
  onSubmitDatabase = defaultSubmitDatabase,
  onSubmitAdmin = defaultSubmitAdmin,
}: FirstRunSetupPageProps) {
  const [step, setStep] = useState<SetupStep>(initialStep);
  const [appUrl, setAppUrl] = useState("");
  const [databaseForm, setDatabaseForm] =
    useState<DatabaseFormState>(defaultDatabaseFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAppUrlSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    const result = await onSubmitAppUrl(appUrl);
    setIsSubmitting(false);
    if (result.success) {
      setStep(stepAfterAppUrl);
    } else {
      setError(result.error ?? "Couldn't save the app URL. Please try again.");
    }
  };

  const handleDatabaseSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    const result = await onSubmitDatabase(databaseForm);
    setIsSubmitting(false);

    if (result.success) {
      setStep(result.setupComplete ? "complete" : "admin");
    } else {
      setError(result.error ?? "We couldn't connect to that database. Double-check your details and try again.");
    }
  };

  const handleAdminSubmit = async (data: AdminFormValues) => {
    setIsSubmitting(true);
    setError(null);
    const result = await onSubmitAdmin(data);
    setIsSubmitting(false);

    if (result.success) {
      setStep("complete");
    } else {
      setError(result.error ?? "Something went wrong. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background relative overflow-hidden">
      {/* Decorative Blurred Blobs */}
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-primary/20 rounded-full blur-3xl opacity-30 pointer-events-none" />
      <div className="absolute top-1/3 -right-32 w-[400px] h-[400px] bg-primary/15 rounded-full blur-3xl opacity-25 pointer-events-none" />
      <div className="absolute bottom-0 left-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl opacity-20 pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image
              src={APP_LOGO}
              alt={`${appName} logo`}
              width={40}
              height={40}
              className="rounded dark:hidden"
            />
            <Image
              src={APP_LOGO_DARK}
              alt={`${appName} logo`}
              width={40}
              height={40}
              className="rounded hidden dark:block"
            />
            <span className="font-bold text-lg">{appName}</span>
          </div>
          <div className="flex gap-x-2">
            <ModeToggle />
            <ThemeSelector />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 w-full flex items-center justify-center px-4 py-12">
        {step === "complete" ? (
          <div className="w-full max-w-md">
            <Card className="shadow-lg text-center">
              <CardHeader className="space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
                  <PartyPopper className="h-6 w-6 text-emerald-500" />
                </div>
                <CardTitle className="text-2xl">You're all set!</CardTitle>
                <CardDescription>
                  Nice work — {appName} is ready to go. Your database is connected and the setup is complete.
                  Sign in whenever you're ready to start setting up your team.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 pb-4 text-left">
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 space-y-1.5">
                  <div className="flex items-center gap-2 font-medium text-sm text-foreground">
                    <KeyRound className="h-4 w-4 text-primary shrink-0" />
                    <span>Next step: Add your API Keys</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Head to <strong className="text-foreground">Settings &gt; API Keys</strong> after signing in to configure keys for <em>The Blue Alliance</em>, <em>FTC Events</em>, or <em>FRC Nexus</em> for event schedule and match data syncing.
                  </p>
                </div>
              </CardContent>
              <CardFooter>
                <Link href={redirectHref} className="w-full">
                  <Button className="w-full">
                    Continue to sign in
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          </div>
        ) : (
          <div className="w-full max-w-4xl grid lg:grid-cols-2 gap-16 items-center">
            <WelcomePanel appName={appName} current={step} />

            <div className="w-full max-w-md mx-auto lg:mx-0">
              <div className="lg:hidden">
                <StepIndicator current={step} />
              </div>

              {step === "app-url" && (
                <AppUrlStep
                  value={appUrl}
                  onChange={setAppUrl}
                  onSubmit={handleAppUrlSubmit}
                  isSubmitting={isSubmitting}
                  error={error}
                />
              )}

              {step === "database" && (
                <DatabaseStep
                  value={databaseForm}
                  onChange={setDatabaseForm}
                  onSubmit={handleDatabaseSubmit}
                  isSubmitting={isSubmitting}
                  error={error}
                />
              )}

              {step === "admin" && (
                <AdminStep
                  onSubmit={handleAdminSubmit}
                  onBack={
                    initialStep === "database" || stepAfterAppUrl === "database"
                      ? () => {
                          setError(null);
                          setStep("database");
                        }
                      : undefined
                  }
                  isSubmitting={isSubmitting}
                  error={error}
                />
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
