"use client";

import * as React from "react";
import { Check, ChevronsUpDown, TriangleAlert, PenLine } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Datapoint } from "@/lib/game-config/datapoint-registry";
import { findDatapoint } from "@/lib/game-config/datapoint-registry";

interface DatapointMultiPickerProps {
  datapoints: Datapoint[];
  values: string[];
  onChange: (keys: string[]) => void;
  placeholder?: string;
  className?: string;
}

/** Picks an ordered set of field keys, shown as removable chips. */
export function DatapointMultiPicker({
  datapoints,
  values,
  onChange,
  placeholder = "Add a field...",
  className,
}: DatapointMultiPickerProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {values.map((key, idx) => {
            const matched = findDatapoint(datapoints, key);
            return (
              <span
                key={`${key}-${idx}`}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px]",
                  matched
                    ? "border-border bg-muted/50"
                    : "border-amber-500/60 bg-amber-500/10",
                )}
              >
                {!matched && (
                  <TriangleAlert className="h-3 w-3 shrink-0 text-amber-500" />
                )}
                <span className="truncate">{matched?.label ?? key}</span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => onChange(values.filter((_, i) => i !== idx))}
                  aria-label={`Remove ${matched?.label ?? key}`}
                >
                  &times;
                </button>
              </span>
            );
          })}
        </div>
      )}
      <DatapointPicker
        datapoints={datapoints.filter((d) => !values.includes(d.key))}
        value={undefined}
        placeholder={placeholder}
        onChange={(key) => {
          if (key && !values.includes(key)) onChange([...values, key]);
        }}
      />
    </div>
  );
}

interface DatapointPickerProps {
  datapoints: Datapoint[];
  value: string | undefined;
  onChange: (key: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Picks a field key from the config being edited. Falls back to free-text so a
 * key that has no matching field (a hand-authored config, or a field not yet
 * created) stays editable instead of being silently unrepresentable.
 */
export function DatapointPicker({
  datapoints,
  value,
  onChange,
  placeholder = "Select a field...",
  disabled,
  className,
}: DatapointPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [manualEntry, setManualEntry] = React.useState(false);

  const matched = findDatapoint(datapoints, value);
  const unresolved = !!value && !matched;

  const grouped = React.useMemo(() => {
    const groups = new Map<string, Datapoint[]>();
    for (const datapoint of datapoints) {
      const existing = groups.get(datapoint.group);
      if (existing) existing.push(datapoint);
      else groups.set(datapoint.group, [datapoint]);
    }
    return [...groups.entries()];
  }, [datapoints]);

  if (manualEntry) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <Input
          autoFocus
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Raw field key"
          className="h-8 font-mono text-xs"
          disabled={disabled}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 px-2 text-xs"
          onClick={() => setManualEntry(false)}
        >
          Done
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "h-8 w-full justify-between px-2 font-normal",
              unresolved && "border-amber-500/60",
            )}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              {unresolved && (
                <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              )}
              <span className="truncate text-xs">
                {matched?.label ?? value ?? (
                  <span className="text-muted-foreground">{placeholder}</span>
                )}
              </span>
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <Command
            filter={(itemValue, search) =>
              itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
            }
          >
            <CommandInput placeholder="Search fields..." className="h-9" />
            <CommandList>
              <CommandEmpty>No matching field.</CommandEmpty>
              {grouped.map(([group, items]) => (
                <CommandGroup key={group} heading={group}>
                  {items.map((datapoint) => (
                    <CommandItem
                      key={`${datapoint.group}:${datapoint.key}`}
                      value={`${datapoint.label} ${datapoint.key}`}
                      onSelect={() => {
                        onChange(datapoint.key);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4 shrink-0",
                          matched?.key === datapoint.key
                            ? "opacity-100"
                            : "opacity-0",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">
                          {datapoint.label}
                        </span>
                        <span className="block truncate font-mono text-[10px] text-muted-foreground">
                          {datapoint.key}
                        </span>
                      </span>
                      <span className="ml-2 shrink-0 text-[10px] text-muted-foreground">
                        {datapoint.valueType}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
              <CommandGroup>
                <CommandItem
                  value="__manual__ enter a raw key manually"
                  onSelect={() => {
                    setManualEntry(true);
                    setOpen(false);
                  }}
                >
                  <PenLine className="mr-2 h-4 w-4 shrink-0" />
                  <span className="text-sm">Enter a raw key manually</span>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {unresolved && (
        <p className="text-[10px] text-amber-600 dark:text-amber-500">
          <span className="font-mono">{value}</span> doesn&apos;t match any
          field in this config.
        </p>
      )}
    </div>
  );
}
