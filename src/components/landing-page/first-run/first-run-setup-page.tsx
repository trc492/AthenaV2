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
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/ui/light-dark-toggle";
import { ThemeSelector } from "@/components/settings/theme-selector";
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
  onSubmitDatabase?: (data: DatabaseFormState) => Promise<SetupResult>;
  onSubmitAdmin?: (data: AdminFormValues) => Promise<SetupResult>;
}

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
    return { success: true };
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
  { key: "database", label: "Database", icon: DatabaseIcon },
  { key: "admin", label: "Admin account", icon: UserPlus },
];

const WELCOME_STEPS = [
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

export function FirstRunSetupPage({
  appName = "Athena",
  redirectHref = "/login",
  initialStep = "database",
  onSubmitDatabase = defaultSubmitDatabase,
  onSubmitAdmin = defaultSubmitAdmin,
}: FirstRunSetupPageProps) {
  const [step, setStep] = useState<SetupStep>(initialStep);
  const [databaseForm, setDatabaseForm] =
    useState<DatabaseFormState>(defaultDatabaseFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDatabaseSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    const result = await onSubmitDatabase(databaseForm);
    setIsSubmitting(false);

    if (result.success) {
      setStep("admin");
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
              src="/TRCLogo.webp"
              alt={`${appName} logo`}
              width={40}
              height={40}
              className="rounded dark:hidden"
            />
            <Image
              src="/TRCLogoWhite.png"
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
                  Nice work — {appName} is ready to go and your admin account is created.
                  Sign in whenever you're ready to start setting up your team.
                </CardDescription>
              </CardHeader>
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
                    initialStep === "admin"
                      ? undefined
                      : () => {
                          setError(null);
                          setStep("database");
                        }
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