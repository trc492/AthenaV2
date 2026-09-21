"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModeToggle } from "@/components/ui/light-dark-toggle";
import { ThemeSelector } from "@/components/settings/theme-selector";
import { ArrowLeft, Eye, EyeOff, UserRound } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { APP_NAME } from "@/lib/app-config";

interface LoginFormData {
  username: string;
  password: string;
}

export default function Page() {
  const [formData, setFormData] = useState<LoginFormData>({
    username: "",
    password: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleInputChange = (field: keyof LoginFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await signIn("credentials", {
        username: formData.username,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        console.error("Login error:", result.error);
        toast.error("Login failed", {
          description: "Invalid username or password",
        });
      } else if (result?.ok) {
        toast.success("Login successful!", {
          description: `Welcome back to ${APP_NAME}!`,
        });
        // Use hard redirect to ensure session cookie is properly sent
        window.location.href = "/dashboard";
      } else {
        console.error("Unexpected login result:", result);
        toast.error("Login failed", {
          description: "An unexpected error occurred",
        });
      }
    } catch (error) {
      console.error("Login exception:", error);
      toast.error("Login failed", {
        description: "An unexpected error occurred",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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
          <Card className="shadow-lg rounded-2xl backdrop-blur-sm">
            <CardHeader className="text-center mt-2">
              <h1 className="text-2xl font-semibold text-primary">
                Log In
              </h1>
              <CardDescription className="text-muted-foreground">
                Log in to your {APP_NAME} account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    value={formData.username}
                    onChange={(e) =>
                      handleInputChange("username", e.target.value)
                    }
                    className="h-11 focus:ring-2 focus:ring-primary/30 md:h-9"
                    required
                  />
                </div>
                {/* Password */}
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) =>
                        handleInputChange("password", e.target.value)
                      }
                      className="h-11 pr-12 focus:ring-2 focus:ring-primary/30 md:h-9 md:pr-10"
                      autoComplete="current-password"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 size-11 md:size-9"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff /> : <Eye />}
                    </Button>
                  </div>
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="mt-6 h-11 w-full md:h-9"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <UserRound className="mr-2 h-4 w-4 animate-spin" />
                      Logging In...
                    </>
                  ) : (
                    <>
                      <UserRound className="mr-2 h-4 w-4" />
                      Log In
                    </>
                  )}
                </Button>

              </form>

              <div className="mt-6 text-center text-sm">
                Don't have an account?{" "}
                <Link
                  href="/signup"
                  className="underline underline-offset-4 hover:text-primary"
                >
                  Sign up
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
