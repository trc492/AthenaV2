import { loadSystemSettings } from "@/lib/server/env-file";
import { SignupForm } from "./signup-form";
import { ModeToggle } from "@/components/ui/light-dark-toggle";
import { ThemeSelector } from "@/components/settings/theme-selector";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Lock } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function Page() {
  const { signupEnabled } = loadSystemSettings();

  return (
    <div className="min-h-screen bg-background dark:bg-background">
      <div className="flex min-h-screen w-full items-center justify-center p-6 md:p-10">
        <div className="fixed top-4 left-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="h-11 md:h-8">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>

        <div className="fixed top-4 right-4">
          <div className="flex gap-x-2">
            <ModeToggle />
            <ThemeSelector />
          </div>
        </div>

        <div className="w-full max-w-md">
          {signupEnabled ? (
            <SignupForm />
          ) : (
            <Card className="shadow-lg rounded-2xl backdrop-blur-sm">
              <CardHeader className="text-center mt-2">
                <div className="flex justify-center mb-3">
                  <Lock className="h-10 w-10 text-muted-foreground" />
                </div>
                <CardTitle className="text-2xl font-semibold text-primary">
                  Sign-Up Disabled
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Public registration is currently disabled. Please contact an
                  administrator to get access.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center pb-6">
                <Link href="/login">
                  <Button variant="outline">Go to Login</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
