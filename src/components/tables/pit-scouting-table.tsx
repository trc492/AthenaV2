"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { ScoutingTableFeatures } from "./table-features";
import type { PitEntry } from "@/lib/types";
import { ScoutingTable, SortableHeader, type ScoutingTableProps } from "./scouting-table";

const columns: ColumnDef<ScoutingTableFeatures, PitEntry>[] = [
  {
    accessorKey: "teamNumber",
    header: ({ column }) => <SortableHeader column={column}>Team</SortableHeader>,
    cell: ({ row }) => <div className="font-medium">{row.original.teamNumber}</div>,
    filterFn: "includesString",
  },
  { accessorKey: "driveTrain", header: "Drive Train" },
  {
    accessorKey: "weight",
    header: ({ column }) => <SortableHeader column={column}>Weight (lbs)</SortableHeader>,
    cell: ({ row }) => row.original.weight ?? "-",
  },
  {
    accessorKey: "length",
    header: "Length (in)",
    cell: ({ row }) => row.original.length ?? "-",
  },
  {
    accessorKey: "width",
    header: "Width (in)",
    cell: ({ row }) => row.original.width ?? "-",
  },
];

export function PitScoutingTable(props: ScoutingTableProps<PitEntry>) {
  return <ScoutingTable {...props} columns={columns} emptyMessage="No pit scouting data found." />;
}
