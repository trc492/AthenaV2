"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Code,
  Copy,
  Check,
  Download,
  Upload,
  Sparkles,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import type { YearConfig } from "@/lib/types";
import { validateYearConfig } from "@/lib/server/config-validator";
import { getErrorMessage } from "@/lib/utils";

interface BuilderJsonEditorProps {
  config: YearConfig;
  year: number;
  onUpdateConfig: (newConfig: YearConfig) => void;
}

export function BuilderJsonEditor({
  config,
  year,
  onUpdateConfig,
}: BuilderJsonEditorProps) {
  const [jsonText, setJsonText] = useState("");
  const [copied, setCopied] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);

  // Synchronize incoming config with text if valid
  useEffect(() => {
    try {
      const formatted = JSON.stringify(config, null, 2);
      setJsonText(formatted);
      setParseError(null);

      const val = validateYearConfig(config);
      setValidationErrors(val.errors);
      setValidationWarnings(val.warnings);
    } catch (err) {
      setParseError(getErrorMessage(err));
    }
  }, [config]);

  const handleTextChange = (val: string) => {
    setJsonText(val);
    try {
      const parsed = JSON.parse(val);
      setParseError(null);
      const valRes = validateYearConfig(parsed);
      setValidationErrors(valRes.errors);
      setValidationWarnings(valRes.warnings);

      if (valRes.valid) {
        onUpdateConfig(parsed);
      }
    } catch (err) {
      setParseError(getErrorMessage(err));
    }
  };

  const handlePrettify = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setJsonText(JSON.stringify(parsed, null, 2));
      setParseError(null);
      toast.success("JSON formatted successfully");
    } catch (err) {
      toast.error(`Invalid JSON syntax: ${getErrorMessage(err)}`);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonText);
    setCopied(true);
    toast.success("JSON copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const filename = `${config.competitionType || "FRC"}-${year || 2026}.json`;
    const blob = new Blob([jsonText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filename}`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        const valRes = validateYearConfig(parsed);
        if (!valRes.valid) {
          toast.warning("Imported JSON has schema validation issues", {
            description: valRes.errors.join(", "),
          });
        }
        setJsonText(JSON.stringify(parsed, null, 2));
        onUpdateConfig(parsed);
        toast.success(`Imported ${file.name}`);
      } catch (err) {
        toast.error(`Failed to parse file: ${getErrorMessage(err)}`);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Code className="h-5 w-5 text-primary" />
                Raw JSON Schema Inspector & Editor
              </CardTitle>
              <CardDescription>
                Directly inspect, edit, export, or import the game YearConfig JSON structure.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePrettify}>
                <Sparkles className="h-3.5 w-3.5 mr-1" /> Format
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? (
                  <Check className="h-3.5 w-3.5 mr-1 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5 mr-1" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-3.5 w-3.5 mr-1" /> Download
              </Button>

              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button variant="secondary" size="sm" asChild>
                  <span>
                    <Upload className="h-3.5 w-3.5 mr-1" /> Import File
                  </span>
                </Button>
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Syntax / Validation Status Banner */}
          {parseError ? (
            <div className="flex items-center gap-2 p-2.5 rounded-md bg-destructive/10 text-destructive text-xs">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>JSON Syntax Error: {parseError}</span>
            </div>
          ) : validationErrors.length > 0 ? (
            <div className="p-2.5 rounded-md bg-destructive/10 text-destructive text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertCircle className="h-4 w-4" /> Schema Validation Errors:
              </div>
              <ul className="list-disc pl-5 space-y-0.5">
                {validationErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-2 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Valid YearConfig JSON schema</span>
            </div>
          )}

          <div className="relative">
            <Textarea
              value={jsonText}
              onChange={(e) => handleTextChange(e.target.value)}
              className="font-mono text-xs h-[500px] leading-relaxed p-4 bg-muted/30 resize-y border-border"
              placeholder="{ ... }"
              spellCheck={false}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
