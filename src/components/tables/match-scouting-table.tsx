"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import { ArrowUpDown, Edit, Trash2, MoreHorizontal } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MatchEntry } from "@/lib/types";

interface MatchScoutingTableProps {
  data: MatchEntry[];
  onEdit: (entry: MatchEntry) => void;
  onDelete: (id: number) => void;
  onDeleteSelected?: (ids: number[]) => void;
}

export const MatchScoutingTable = React.memo(function MatchScoutingTable({
  data,
  onEdit,
  onDelete,
  onDeleteSelected,
}: MatchScoutingTableProps) {
  const { data: session } = useSession();
  const isGuest = !!session?.guestEvent;
  const [rowSelection, setRowSelection] = React.useState({});

  // Expose selected IDs
  const selectedIds = React.useMemo(() => {
    return Object.keys(rowSelection)
      .filter((key) => rowSelection[key as keyof typeof rowSelection])
      .map((key) => {
        const row = data[parseInt(key)];
        return row?.id;
      })
      .filter((id): id is number => id !== undefined && id !== null);
  }, [rowSelection, data]);

  const columns = React.useMemo<ColumnDef<MatchEntry>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <div className="ml-2">
            <Checkbox
              checked={
                table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() && "indeterminate")
              }
              onCheckedChange={(value) =>
                table.toggleAllPageRowsSelected(!!value)
              }
              aria-label="Select all"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="ml-2">
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="Select row"
            />
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "matchNumber",
        header: ({ column }) => (
          <button
            className="h-8 flex items-center hover:text-primary"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Match <ArrowUpDown className="p-1" />
          </button>
        ),
        cell: ({ row }) => (
          <div className="font-medium text-sm">
            #{row.getValue("matchNumber")}
          </div>
        ),
      },
      {
        accessorKey: "teamNumber",
        header: ({ column }) => (
          <button
            className="h-8 flex items-center hover:text-primary"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Team <ArrowUpDown className="p-1" />
          </button>
        ),
        cell: ({ row }) => (
          <div className="font-medium text-sm">
            {row.getValue("teamNumber")}
          </div>
        ),
      },
      {
        accessorKey: "alliance",
        header: "Alliance",
        cell: ({ row }) => {
          const alliance = row.getValue("alliance") as string;
          return (
            <div className="">
              <Badge
                className={`text-xs px-1.5 py-0 ${alliance === "blue" ? "bg-blue-400 hover:bg-blue-500 text-white" : "bg-red-400 hover:bg-red-500 text-white"}`}
              >
                {alliance.toUpperCase()}
              </Badge>
            </div>
          );
        },
      },
      {
        accessorKey: "timestamp",
        header: ({ column }) => (
          <button
            className="h-8 flex items-center hover:text-primary"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Time <ArrowUpDown className="p-1" />
          </button>
        ),
        cell: ({ row }) => {
          const timestamp = row.getValue("timestamp") as Date;
          return <div className="text-xs">{timestamp.toLocaleString()}</div>;
        },
      },
      {
        accessorKey: "gameSpecificData",
        header: "Performance",
        cell: ({ row }) => {
          const data = row.getValue(
            "gameSpecificData",
          ) as MatchEntry["gameSpecificData"];
          // Show some key metrics - this could be customized based on game
          const metrics = [];
          // Add some common scoring metrics
          if (data.autoPoints !== undefined)
            metrics.push(`Auto: ${data.autoPoints}`);
          if (data.teleopPoints !== undefined)
            metrics.push(`Teleop: ${data.teleopPoints}`);
          if (data.totalPoints !== undefined)
            metrics.push(`Total: ${data.totalPoints}`);
          return <div className="text-xs">{metrics.join(", ")}</div>;
        },
      },
      {
        accessorKey: "notes",
        header: "Notes",
        cell: ({ row }) => {
          const notes = row.getValue("notes") as string;
          return (
            <div className="text-xs max-w-xs truncate" title={notes}>
              {notes}
            </div>
          );
        },
      },
      {
        id: "actions",
        enableHiding: false,
        cell: ({ row }) => {
          const entry = row.original;

          return (
            <div className="text-right mr-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => entry.id && onEdit(entry)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => entry.id && onDelete(entry.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [onEdit, onDelete],
  );

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});

  const table = useReactTable({
    data,
    columns: isGuest ? columns.filter((column) => column.id !== "actions" && column.id !== "select" && (!("accessorKey" in column) || column.accessorKey !== "notes")) : columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  return (
    <div className="w-full">
      <div className="flex justify-between items-center pb-2 gap-2">
        <Input
          placeholder="Filter teams..."
          value={
            (table.getColumn("teamNumber")?.getFilterValue() as string) ?? ""
          }
          onChange={(event) =>
            table.getColumn("teamNumber")?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
        />
        {!isGuest && selectedIds.length > 0 && onDeleteSelected && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onDeleteSelected(selectedIds)}
            className=""
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete {selectedIds.length} selected
          </Button>
        )}
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No match scouting data found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 pt-2">
        <div className="flex-1 text-xs text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
});
