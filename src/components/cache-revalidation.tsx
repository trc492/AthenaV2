"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import { RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function CacheRevalidationComponent() {
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleRevalidateCache = async () => {
    setIsRevalidating(true);

    try {
      const response = await fetch("/api/system/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to revalidate cache");
      }

      const data = await response.json();
      toast.success("Cache revalidated successfully", {
        description: data.message || "All cached routes have been cleared.",
      });
      setDialogOpen(false);
    } catch (error) {
      console.error("Revalidation error:", error);
      toast.error("Failed to revalidate cache", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsRevalidating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Cache Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <h4 className="font-medium">Revalidate Next.js Cache</h4>
          <p className="text-sm text-muted-foreground">
            Force revalidation of all Next.js cached routes and data. Use this
            if you notice stale data or after making configuration changes that
            aren't reflecting immediately.
          </p>
        </div>

        <Button
          variant="outline"
          disabled={isRevalidating}
          className="w-full"
          onClick={() => setDialogOpen(true)}
        >
          {isRevalidating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          {isRevalidating ? "Revalidating..." : "Revalidate Cache"}
        </Button>

        <DeleteConfirmationDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onConfirm={handleRevalidateCache}
          title="Revalidate Next.js Cache?"
          description="This will force Next.js to clear all cached routes and regenerate them on the next request. This is useful for clearing stale data but may temporarily slow down the first page loads after revalidation."
          loading={isRevalidating}
          confirmButtonText="Revalidate"
          loadingText="Revalidating..."
        />
      </CardContent>
    </Card>
  );
}
