"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Upload,
  FileText,
  FileSpreadsheet,
  Database,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useGameConfig } from "@/hooks/use-game-config";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ExportFormat = "json" | "csv" | "xlsx";

export function DataExportImportComponent() {
  const { config, competitionType } = useGameConfig();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [importProgress, setImportProgress] = useState(0);
  const [selectedYear, setSelectedYear] = useState<number | undefined>(
    undefined,
  );
  const [includePit, setIncludePit] = useState(false);
  const [includeMatch, setIncludeMatch] = useState(false);


  // Get available years for the current competition type
  const availableYears = useMemo(() => {
    const years = Object.keys(config[competitionType] || {}).map((year) => ({
      year: parseInt(year),
      gameName: config[competitionType][year].gameName,
    }));

    return years.sort((a, b) => b.year - a.year);
  }, [config, competitionType]);

  const handleExport = async (format: ExportFormat) => {
    // Validate selection before starting
    if (!includePit && !includeMatch) {
      toast.error("Please select at least one data type to export");
      return;
    }

    setIsExporting(true);
    setExportProgress(0);

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setExportProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 15;
        });
      }, 500);

      const params = new URLSearchParams();
      if (selectedYear) {
        params.append("year", selectedYear.toString());
      }
      params.append("format", format);
      params.append("competitionType", competitionType);

      // Ensure at least one type is selected
      const types: string[] = [];
      if (includePit) types.push("pit");
      if (includeMatch) types.push("match");

      if (types.length === 0) {
        throw new Error("Please select at least one data type to export");
      }

      params.append("types", types.join(","));

      const response = await fetch(`/api/scouting/admin/export?${params}`);
      if (!response.ok) {
        throw new Error("Failed to export data");
      }

      setExportProgress(95);

      // Build descriptive filename
      const yearInfo = selectedYear
        ? availableYears.find((y) => y.year === selectedYear)
        : null;

      const dataTypeStr =
        types.length === 2
          ? "all-scouting"
          : types[0] === "pit"
          ? "pit-scouting"
          : "match-scouting";

      const yearStr = yearInfo
        ? `${yearInfo.year}-${yearInfo.gameName.replace(/\s+/g, "-")}`
        : "all-years";

      let filename = `${competitionType}-${yearStr}-${dataTypeStr}.${format}`;

      // Check if server provided a different filename
      const contentDisposition = response.headers.get("content-disposition");
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Download the file
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportProgress(100);
      clearInterval(progressInterval);

      toast.success(`Data exported successfully as ${format.toUpperCase()}`, {
        description: `File: ${filename}`,
        duration: 5000,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export data", {
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
        duration: 5000,
      });
    } finally {
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(0);
      }, 1000);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportProgress(0);

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setImportProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 10;
        });
      }, 600);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/scouting/admin/import", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to import data");
      }

      setImportProgress(100);
      clearInterval(progressInterval);

      toast.success("Data imported successfully", {
        description: `File: ${file.name}`,
        duration: 5000,
      });
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Failed to import data", {
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
        duration: 5000,
      });
    } finally {
      setTimeout(() => {
        setIsImporting(false);
        setImportProgress(0);
        // Reset file input
        event.target.value = "";
      }, 1000);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Data Export/Import
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="year-select" className="text-sm font-medium">
            Filter by Year (optional)
          </label>
          <Select
            value={selectedYear ? selectedYear.toString() : ""}
            onValueChange={(value) =>
              setSelectedYear(value ? parseInt(value) : undefined)
            }
          >
            <SelectTrigger className="w-full p-2 border rounded-md">
              <SelectValue placeholder="All Years" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {availableYears.map(({ year, gameName }) => (
                <SelectItem key={year} value={year.toString()}>
                  {year} ({gameName})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium">Export Data</h4>
          {isExporting && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Exporting data... ({Math.round(exportProgress)}%)
              </div>
              <Progress value={exportProgress} className="h-2" />
            </div>
          )}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={includePit}
                onCheckedChange={(checked) => setIncludePit(checked === true)}
              />
              Pit Scouting
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={includeMatch}
                onCheckedChange={(checked) => setIncludeMatch(checked === true)}
              />
              Match Scouting
            </label>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={() => handleExport("json")}
              disabled={isExporting || (!includePit && !includeMatch)}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 transition-all duration-200"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              JSON
            </Button>
            <Button
              onClick={() => handleExport("csv")}
              disabled={isExporting || (!includePit && !includeMatch)}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 transition-all duration-200"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              CSV
            </Button>
            <Button
              onClick={() => handleExport("xlsx")}
              disabled={isExporting || (!includePit && !includeMatch)}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 transition-all duration-200"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              Excel
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium">Import Data</h4>
          {isImporting && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Importing data... ({Math.round(importProgress)}%)
              </div>
              <Progress value={importProgress} className="h-2" />
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept=".json,.csv,.xlsx"
              onChange={handleImport}
              disabled={isImporting}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload">
              <Button
                asChild
                disabled={isImporting}
                variant="outline"
                size="sm"
                className="flex items-center gap-2 cursor-pointer transition-all duration-200"
              >
                <span>
                  {isImporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Choose File
                </span>
              </Button>
            </label>
            <Badge variant="secondary">JSON, CSV, XLSX supported</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Import will replace existing data for the imported types and years
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
