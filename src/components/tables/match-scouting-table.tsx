"use client";

import { memo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { ScoutingTableFeatures } from "./table-features";
import { Badge } from "@/components/ui/badge";
import type { MatchEntry } from "@/lib/types";
import { ScoutingTable, SortableHeader, type ScoutingTableProps } from "./scouting-table";

const columns: ColumnDef<ScoutingTableFeatures, MatchEntry>[] = [
  {
    accessorKey: "matchNumber",
    header: ({ column }) => <SortableHeader column={column}>Match</SortableHeader>,
    cell: ({ row }) => <div className="font-medium text-sm">#{row.original.matchNumber}</div>,
  },
  {
    accessorKey: "teamNumber",
    header: ({ column }) => <SortableHeader column={column}>Team</SortableHeader>,
    cell: ({ row }) => <div className="font-medium text-sm">{row.original.teamNumber}</div>,
    filterFn: "includesString",
  },
  {
    accessorKey: "alliance",
    header: "Alliance",
    cell: ({ row: { original: { alliance } } }) => (
      <Badge className={`text-xs px-1.5 py-0 text-white ${alliance === "blue"
        ? "bg-blue-400 hover:bg-blue-500" : "bg-red-400 hover:bg-red-500"}`}>
        {alliance.toUpperCase()}
      </Badge>
    ),
  },
  {
    accessorKey: "timestamp",
    header: ({ column }) => <SortableHeader column={column}>Time</SortableHeader>,
    cell: ({ row }) => <div className="text-xs">{new Date(row.original.timestamp).toLocaleString()}</div>,
  },
  {
    accessorKey: "gameSpecificData",
    header: "Performance",
    cell: ({ row: { original: { gameSpecificData: data } } }) => {
      const metrics = [
        ["autoPoints", "Auto"], ["teleopPoints", "Teleop"], ["totalPoints", "Total"],
      ].filter(([key]) => data[key] !== undefined)
        .map(([key, label]) => `${label}: ${data[key]}`);
      return <div className="text-xs">{metrics.join(", ")}</div>;
    },
  },
  {
    accessorKey: "notes",
    header: "Notes",
    cell: ({ row }) => (
      <div className="text-xs max-w-xs truncate" title={row.original.notes}>
        {row.original.notes}
      </div>
    ),
  },
];

export const MatchScoutingTable = memo(function MatchScoutingTable(props: ScoutingTableProps<MatchEntry>) {
  return <ScoutingTable {...props} columns={columns} emptyMessage="No match scouting data found." />;
});
