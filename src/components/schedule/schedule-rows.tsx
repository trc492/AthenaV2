"use client";

import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UserWithPartners, MatchAssignment } from "@/lib/schedule/assignments";

export const MatchAssignmentRow = React.memo(
  ({
    match,
    scoutsPerAlliance,
    getAvailableUsersForMatchSlot,
    setLocalMatchScout,
  }: {
    match: MatchAssignment;
    scoutsPerAlliance: number;
    getAvailableUsersForMatchSlot: (
      match: MatchAssignment,
      alliance: "red" | "blue",
      position: number,
    ) => UserWithPartners[];
    setLocalMatchScout: (
      matchNumber: number,
      alliance: "red" | "blue",
      position: number,
      scoutId: string | null,
    ) => void;
  }) => {
    return (
      <div className="rounded-md border px-3 py-2">
        <div className="flex flex-col flex-wrap gap-3">
          <div className="text-sm font-semibold">
            Match {match.matchNumber}
          </div>
          <div className="text-xs text-muted-foreground">
            {[...match.redScouts, ...match.blueScouts].filter(Boolean).length} / {scoutsPerAlliance * 2} positions filled
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-2">
            {(["red", "blue"] as const).map((alliance) => (
              <div
                key={`${match.matchNumber}-${alliance}`}
                className="min-w-0 rounded-md bg-muted/40 p-3 space-y-2"
              >
                <span
                  className={`text-xs font-medium w-8 ${alliance === "red" ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"}`}
                >
                  {alliance === "red" ? "Red" : "Blue"}
                </span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {Array.from({ length: scoutsPerAlliance }, (_, position) => {
                    const slotValue =
                      alliance === "red"
                        ? match.redScouts[position]
                        : match.blueScouts[position];
                    const availableUsers = getAvailableUsersForMatchSlot(
                      match,
                      alliance,
                      position,
                    );
                    return (
                      <Select
                        key={`${match.matchNumber}-${alliance}-${position}`}
                        value={slotValue ?? "none"}
                        onValueChange={(value) =>
                          setLocalMatchScout(
                            match.matchNumber,
                            alliance,
                            position,
                            value === "none" ? null : value,
                          )
                        }
                      >
                        <SelectTrigger
                          aria-label={`Match ${match.matchNumber}, ${alliance} position ${position + 1}`}
                          className="w-full min-w-0 text-xs"
                        >
                          <span className="shrink-0 text-muted-foreground">{position + 1}</span>
                          <SelectValue placeholder="Open" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Open</SelectItem>
                          {availableUsers.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  },
);
MatchAssignmentRow.displayName = "MatchAssignmentRow";

export const ActiveScoutCheckbox = React.memo(
  ({
    scout,
    isActive,
    onToggle,
  }: {
    scout: UserWithPartners;
    isActive: boolean;
    onToggle: (scoutId: string, checked: boolean) => void;
  }) => (
    <div className="flex items-center space-x-2">
      <Checkbox
        id={`active-${scout.id}`}
        checked={isActive}
        onCheckedChange={(checked) => onToggle(scout.id, checked === true)}
      />
      <label
        htmlFor={`active-${scout.id}`}
        className="text-sm font-medium cursor-pointer"
      >
        {scout.name}
      </label>
    </div>
  ),
);
ActiveScoutCheckbox.displayName = "ActiveScoutCheckbox";

