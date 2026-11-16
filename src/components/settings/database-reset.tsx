"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

export function DatabaseResetComponent() {
  const [isResetting, setIsResetting] = useState(false);
  const [resetProgress, setResetProgress] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleResetDatabase = async () => {
    setDialogOpen(false);
    setIsResetting(true);
    setResetProgress(0);

    // Simulate progress for the reset operation
    const progressInterval = setInterval(() => {
      setResetProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 10;
      });
    }, 500);

    try {
      const response = await fetch("/api/scouting/admin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to reset database");
      }

      setResetProgress(100);
      toast.success("Database reset successfully", {
        description: "All scouting data has been permanently deleted.",
      });
    } catch (error) {
      console.error("Reset error:", error);
      toast.error("Failed to reset database", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setTimeout(() => {
        setIsResetting(false);
        setResetProgress(0);
      }, 1000);
    }
  };

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Danger Zone
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <h4 className="font-medium">Reset Database</h4>
          {isResetting && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Resetting database... ({Math.round(resetProgress)}%)
              </div>
              <Progress value={resetProgress} className="h-2" />
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Permanently delete all pit and match scouting entries. Accounts,
            events, schedules and picklists are kept. This action cannot be
            undone.
          </p>
        </div>

        <Button
          variant="destructive"
          disabled={isResetting}
          className="w-full"
          onClick={() => setDialogOpen(true)}
        >
          {isResetting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="mr-2 h-4 w-4" />
          )}
          {isResetting ? "Resetting..." : "Reset Database"}
        </Button>

        <DeleteConfirmationDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onConfirm={handleResetDatabase}
          title="Are you absolutely sure?"
          description={
            <>
              This action cannot be undone. This will permanently delete all
              scouting data from the database, including:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>All pit scouting entries</li>
                <li>All match scouting entries</li>
              </ul>
              <br />
              Make sure you have backed up any important data before proceeding.
            </>
          }
          loading={isResetting}
          confirmButtonText="Yes, reset database"
          loadingText="Resetting..."
          variant="destructive"
        />
      </CardContent>
    </Card>
  );
}
