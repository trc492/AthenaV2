"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import {
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  type RowData,
  type RowSelectionState,
  type SortingState,
  flexRender,
  useTable,
} from "@tanstack/react-table";
import { ArrowUpDown, Edit, MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { scoutingTableFeatures, type ScoutingTableFeatures } from "./table-features";

interface ScoutingEntry {
  id?: number;
  teamNumber: number;
}

export interface ScoutingTableProps<T extends ScoutingEntry> {
  data: T[];
  onEdit: (entry: T) => void;
  onDelete: (id: number) => void;
  onDeleteSelected?: (ids: number[]) => void;
}

export function SortableHeader<T extends RowData>({ column, children }: {
  column: Column<ScoutingTableFeatures, T>;
  children: ReactNode;
}) {
  return (
    <button
      className="h-8 flex items-center hover:text-primary"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {children} <ArrowUpDown className="p-1" />
    </button>
  );
}

/** Shared table behavior; callers supply only their scouting-specific columns. */
export function ScoutingTable<T extends ScoutingEntry>({
  data, columns, emptyMessage, onEdit, onDelete, onDeleteSelected,
}: ScoutingTableProps<T> & { columns: ColumnDef<ScoutingTableFeatures, T>[]; emptyMessage: string }) {
  const { data: session } = useSession();
  const isGuest = !!session?.guestEvent;
  const canViewNotes = !!session?.guestEvent?.canViewNotes;
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const tableColumns = useMemo<ColumnDef<ScoutingTableFeatures, T>[]>(() => {
    const visibleColumns = columns.filter((column) =>
      !isGuest || canViewNotes || !("accessorKey" in column) || column.accessorKey !== "notes",
    );
    if (isGuest) return visibleColumns;
    return [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
      },
      ...visibleColumns,
      {
        id: "actions",
        cell: ({ row: { original: entry } }) => (
          <div className="text-right mr-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0" disabled={entry.id == null}>
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => entry.id != null && onEdit(entry)}>
                  <Edit className="mr-2 h-4 w-4" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => entry.id != null && onDelete(entry.id)}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ];
  }, [columns, isGuest, canViewNotes, onEdit, onDelete]);

  const table = useTable({
    features: scoutingTableFeatures,
    data,
    columns: tableColumns,
    // Keep selection attached to records when refreshed data changes order.
    getRowId: (entry, index) => entry.id == null ? `unsaved-${index}` : String(entry.id),
    enableRowSelection: (row) => !isGuest && row.original.id != null,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    state: { sorting, columnFilters, rowSelection },
  });
  const selectedIds = table.getSelectedRowModel().rows
    .map((row) => row.original.id)
    .filter((id): id is number => id != null);

  return (
    <div className="w-full">
      <div className="flex justify-between items-center pb-2 gap-2">
        <Input
          placeholder="Filter teams..."
          value={(table.getColumn("teamNumber")?.getFilterValue() as string) ?? ""}
          onChange={(event) => table.getColumn("teamNumber")?.setFilterValue(event.target.value)}
          className="max-w-sm"
        />
        {!isGuest && selectedIds.length > 0 && onDeleteSelected && (
          <Button variant="destructive" size="sm" onClick={() => onDeleteSelected(selectedIds)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete {selectedIds.length} selected
          </Button>
        )}
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead key={header.id}>
                    {!header.isPlaceholder && flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={tableColumns.length} className="h-24 text-center">
                  {emptyMessage}
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
        <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
          Previous
        </Button>
        <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
          Next
        </Button>
      </div>
    </div>
  );
}
