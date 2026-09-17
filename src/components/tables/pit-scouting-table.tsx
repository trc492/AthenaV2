"use client";

import * as React from "react";
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
import { PitEntry } from "@/lib/types";

interface PitScoutingTableProps {
  data: PitEntry[];
  onEdit: (entry: PitEntry) => void;
  onDelete: (id: number) => void;
  onDeleteSelected?: (ids: number[]) => void;
}

export function PitScoutingTable({
  data,
  onEdit,
  onDelete,
  onDeleteSelected,
}: PitScoutingTableProps) {
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

  const columns: ColumnDef<PitEntry>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <div className="">
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
      accessorKey: "teamNumber",
      header: ({ column }) => (
        <button
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="flex hover:text-primary"
        >
          Team <ArrowUpDown className="p-1" />
        </button>
      ),
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("teamNumber")}</div>
      ),
    },
    {
      accessorKey: "driveTrain",
      header: "Drive Train",
      cell: ({ row }) => <div className="">{row.getValue("driveTrain")}</div>,
    },
    {
      accessorKey: "weight",
      header: ({ column }) => (
        <button
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="flex hover:text-primary"
        >
          Weight (lbs) <ArrowUpDown className="p-1" />
        </button>
      ),
      cell: ({ row }) => {
        const value = row.getValue("weight") as number | undefined;
        return (
          <div className="">
            {value !== undefined && value !== null ? value : "-"}
          </div>
        );
      },
    },
    {
      accessorKey: "length",
      header: "Length (in)",
      cell: ({ row }) => {
        const value = row.getValue("length") as number | undefined;
        return (
          <div className="">
            {value !== undefined && value !== null ? value : "-"}
          </div>
        );
      },
    },
    {
      accessorKey: "width",
      header: "Width (in)",
      cell: ({ row }) => {
        const value = row.getValue("width") as number | undefined;
        return (
          <div className="">
            {value !== undefined && value !== null ? value : "-"}
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
  ];

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});

  const table = useReactTable({
    data,
    columns,
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
      <div className="flex items-center pb-2 gap-2">
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
        {selectedIds.length > 0 && onDeleteSelected && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onDeleteSelected(selectedIds)}
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
                  No pit scouting data found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 pt-4">
        <div className="flex-1 text-sm text-muted-foreground">
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
}
