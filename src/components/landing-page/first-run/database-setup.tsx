"use client";

import { Database, Loader2, AlertCircle, ArrowRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DatabaseProviderFields } from "@/components/database-provider-fields";
import {
  isDatabaseFormValid,
  DatabaseFormState,
} from "@/lib/types/db/providers";

interface DatabaseStepProps {
  value: DatabaseFormState;
  onChange: (value: DatabaseFormState) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  error: string | null;
}

export function DatabaseStep({
  value,
  onChange,
  onSubmit,
  isSubmitting,
  error,
}: DatabaseStepProps) {
  const canSubmit = isDatabaseFormValid(value) && !isSubmitting;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canSubmit) onSubmit();
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="text-center space-y-3">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Database className="h-6 w-6 text-primary" />
        </div>
        <div>
          <CardTitle className="text-2xl">Connect your database</CardTitle>
          <CardDescription className="mt-2">
            Choose a provider and enter its connection details. We'll
            verify the connection before moving on.
          </CardDescription>
        </div>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4 pb-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Connection failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DatabaseProviderFields
            value={value}
            onChange={onChange}
            mode="setup"
          />
        </CardContent>

        <CardFooter>
          <Button type="submit" className="w-full" disabled={!canSubmit}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testing connection &amp; saving...
              </>
            ) : (
              <>
                Test connection &amp; continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}