"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Plus,
  AlertCircle,
  Database,
  Download,
  ChevronDown,
  WifiOff,
  Users,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { PitScoutingTable } from "@/components/tables/pit-scouting-table";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import { PitEntry } from "@/lib/types/db/entries";
import { useGameConfig } from "@/hooks/use-game-config";
import { useScoutingEntries } from "@/hooks/use-scouting-entries";
import { useEventConfig } from "@/hooks/use-event-config";

export default function PitScoutingPage() {
  const { data: session } = useSession();
  const isGuest = !!session?.guestEvent;
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<number | null>(null);
  const [entriesToDelete, setEntriesToDelete] = useState<number[]>([]);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { getCurrentYearConfig, currentYear, competitionType } =
    useGameConfig();
  const gameConfig = getCurrentYearConfig();
  const { selectedEvent } = useEventConfig();
  const {
    entries: pitEntries,
    loading,
    error,
    isOfflineData,
    refetch,
  } = useScoutingEntries("pit");

  const handleExport = async (format: "json" | "csv" | "xlsx" = "csv") => {
    try {
      const params = new URLSearchParams();
      params.append("year", currentYear.toString());
      params.append("format", format);
      params.append("types", "pit"); // Only export pit data
      if (selectedEvent?.eventCode) {
        params.append("eventCode", selectedEvent.eventCode);
      }
      params.append("competitionType", competitionType);

      const response = await fetch(`/api/scouting/admin/export?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to export data");
      }

      // Get filename from response headers or create default
      const contentDisposition = response.headers.get("content-disposition");
      let filename = `pit-scouting-${currentYear}${selectedEvent ? `-${selectedEvent.eventCode}` : ""}.${format}`;

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Download the file
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Data exported successfully as ${format.toUpperCase()}`);
    } catch (err) {
      console.error("Error exporting data:", err);
      toast.error("Failed to export data");
    }
  };

  // Handle edit - navigate to scout form with edit ID
  const handleEdit = (entry: PitEntry) => {
    window.location.href = `/scout/pitscout?editId=${entry.id}`;
  };

  // Handle delete
  const handleDelete = (id: number) => {
    setEntryToDelete(id);
    setEntriesToDelete([]);
    setDeleteDialogOpen(true);
  };

  // Handle bulk delete
  const handleDeleteSelected = (ids: number[]) => {
    setEntriesToDelete(ids);
    setEntryToDelete(null);
    setDeleteDialogOpen(true);
  };

  // Confirm delete
  const confirmDelete = async () => {
    const idsToDelete = entryToDelete ? [entryToDelete] : entriesToDelete;
    if (idsToDelete.length === 0) return;

    setDeleteLoading(true);
    try {
      let failedCount = 0;
      for (const id of idsToDelete) {
        const response = await fetch(`/api/scouting/entries/pit?id=${id}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          failedCount++;
        }
      }

      // Refresh data
      refetch();

      if (failedCount > 0) {
        toast.warning(
          `Deleted ${idsToDelete.length - failedCount} of ${idsToDelete.length} entries. ${failedCount} failed.`,
        );
      } else if (idsToDelete.length === 1) {
        toast.success("Pit entry deleted successfully");
      } else {
        toast.success(`${idsToDelete.length} pit entries deleted successfully`);
      }

      setDeleteDialogOpen(false);
      setEntryToDelete(null);
      setEntriesToDelete([]);
    } catch (err) {
      console.error("Error deleting pit entries:", err);
      toast.error("Failed to delete pit entries");
    } finally {
      setDeleteLoading(false);
    }
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="grid grid-rows-2 md:grid-cols-2 gap-2 md:-mb-12">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Pit Scouting</h1>
            <p className="text-muted-foreground">
              View and manage pit scouting data for teams
            </p>
          </div>
          {isOfflineData && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <WifiOff className="h-3 w-3" />
              Cached Data
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 md:justify-end">
          {!isGuest && <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport("csv")}>
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("json")}>
                Export as JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("xlsx")}>
                Export as Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>}
          {!isGuest && <Button onClick={() => window.open("/scout/pitscout", "_blank")}>
            <Plus className="mr-2 h-4 w-4" />
            Add New Entry
          </Button>}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="gap-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Total Entries</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pitEntries.length}</div>
            <p className="text-xs text-muted-foreground">
              Pit scouting records
            </p>
          </CardContent>
        </Card>

        <Card className="gap-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Unique Teams</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(pitEntries.map((entry) => entry.teamNumber)).size}
            </div>
            <p className="text-xs text-muted-foreground">Teams scouted</p>
          </CardContent>
        </Card>

        <Card className="gap-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Game Year</CardTitle>
            <Badge variant="outline">{currentYear}</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {gameConfig?.gameName || "REEFSCAPE"}
            </div>
            <p className="text-xs text-muted-foreground">Current season</p>
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Pit Scouting Data</CardTitle>
          <CardDescription>
            View and manage all pit scouting entries. Click the actions menu to
            edit or delete entries.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <PitScoutingTable
              data={pitEntries}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onDeleteSelected={isGuest ? undefined : handleDeleteSelected}
            />
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title={
          entriesToDelete.length > 1
            ? `Delete ${entriesToDelete.length} Pit Entries`
            : "Delete Pit Entry"
        }
        description={
          entriesToDelete.length > 1
            ? `Are you sure you want to delete ${entriesToDelete.length} pit scouting entries? This action cannot be undone.`
            : "Are you sure you want to delete this pit scouting entry? This action cannot be undone."
        }
        loading={deleteLoading}
      />
    </div>
  );
}
