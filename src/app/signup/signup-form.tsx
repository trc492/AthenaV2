"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Users, UserPlus } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { APP_NAME } from "@/lib/app-config";

interface SignupFormData {
  name: string;
  username: string;
  password: string;
  confirmPassword: string;
}

export function SignupForm() {
  const [formData, setFormData] = useState<SignupFormData>({
    name: "",
    username: "",
    password: "",
    confirmPassword: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleInputChange = (
    field: keyof SignupFormData,
    value: string | boolean,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }

    if (formData.password.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          username: formData.username,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Account created successfully!", {
          description: `Welcome to ${APP_NAME}! Please sign in.`,
        });
        // Redirect to login page
        window.location.href = "/login";
      } else {
        toast.error("Registration failed", {
          description: data.error || "An error occurred during registration",
        });
      }
    } catch {
      toast.error("Registration failed", {
        description: "Network error. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="shadow-lg rounded-2xl backdrop-blur-sm">
      <CardHeader className="text-center mt-2">
        <h1 className="text-2xl font-semibold text-primary">
          Create Account
        </h1>
        <CardDescription className="text-muted-foreground">
          Join the {APP_NAME} scouting platform
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Personal Information */}
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) =>
                  handleInputChange("name", e.target.value)
                }
                required
                className="h-11 focus:ring-2 focus:ring-primary/30 md:h-9"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              placeholder="johndoe492"
              value={formData.username}
              onChange={(e) =>
                handleInputChange("username", e.target.value)
              }
              required
              className="h-11 focus:ring-2 focus:ring-primary/30 md:h-9"
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
                required
                minLength={8}
                autoComplete="new-password"
                aria-describedby="password-requirements"
                className="h-11 pr-12 focus:ring-2 focus:ring-primary/30 md:h-9 md:pr-10"
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
            <p id="password-requirements" className="text-xs text-muted-foreground">
              Use at least 8 characters.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={formData.confirmPassword}
                onChange={(e) =>
                  handleInputChange("confirmPassword", e.target.value)
                }
                required
                minLength={8}
                autoComplete="new-password"
                aria-invalid={
                  formData.confirmPassword.length > 0 &&
                  formData.password !== formData.confirmPassword
                }
                className="h-11 pr-12 focus:ring-2 focus:ring-primary/30 md:h-9 md:pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 size-11 md:size-9"
                onClick={() => setShowConfirmPassword((value) => !value)}
                aria-label={showConfirmPassword ? "Hide confirmation password" : "Show confirmation password"}
              >
                {showConfirmPassword ? <EyeOff /> : <Eye />}
              </Button>
            </div>
            {formData.confirmPassword.length > 0 &&
              formData.password !== formData.confirmPassword && (
                <p className="text-xs text-destructive" role="alert">
                  Passwords do not match.
                </p>
              )}
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="mt-6 h-11 w-full md:h-9"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Users className="mr-2 h-4 w-4 animate-spin" />
                Creating Account...
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Create Account
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm">
          Already have an account?{" "}
          <Link
            href="/login"
            className="underline underline-offset-4 hover:text-primary"
          >
            Log in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
