"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import { ArrowUpDown, ChevronDown, Filter } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AnalysisMetricDefinition } from "@/lib/types";

interface AnalysisTableRow {
  team: string;
  matchesPlayed: number;
  auto: number;
  teleop: number;
  endgame: number;
  penalties: number;
  totalEPA: number;
  detailMetrics: Record<string, number>;
  selectedMetric?: string;
  selectedMetricValue?: number;
}

function formatToTenths(value: number): string {
  return Number.isFinite(value) ? value.toFixed(1) : "0.0";
}

export const columns: ColumnDef<AnalysisTableRow>[] = [
  {
    accessorKey: "team",
    header: "Team",
    enableHiding: false,
    cell: ({ row }) => <div className="capitalize">{row.getValue("team")}</div>,
  },
  {
    accessorKey: "selectedMetric",
    header: ({ column }) => (
      <div className="flex justify-center">
        <button
          className="flex items-center hover:text-primary"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Selected Metric <ArrowUpDown className="pl-2" />
        </button>
      </div>
    ),
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.selectedMetricValue ?? 0;
      const b = rowB.original.selectedMetricValue ?? 0;
      return a === b ? 0 : a > b ? 1 : -1;
    },
    cell: ({ row }) => (
      <div className="text-center">
        {row.getValue("selectedMetric") as string}
      </div>
    ),
  },
  {
    accessorKey: "auto",
    header: ({ column }) => (
      <div className="flex justify-end">
        <button
          className="flex items-center hover:text-primary"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Auto <ArrowUpDown className="pl-2" />
        </button>
      </div>
    ),
    cell: ({ row }) => <div className="text-right">{row.getValue("auto")}</div>,
  },
  {
    accessorKey: "teleop",
    header: ({ column }) => (
      <div className="flex justify-end">
        <button
          className="flex items-center hover:text-primary"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Teleop <ArrowUpDown className="pl-2" />
        </button>
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-right">{row.getValue("teleop")}</div>
    ),
  },
  {
    accessorKey: "endgame",
    header: ({ column }) => (
      <div className="flex justify-end">
        <button
          className="flex items-center hover:text-primary"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Endgame <ArrowUpDown className="pl-2" />
        </button>
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-right">{row.getValue("endgame")}</div>
    ),
  },
  {
    accessorKey: "penalties",
    header: ({ column }) => (
      <div className="flex justify-end">
        <button
          className="flex items-center hover:text-primary"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Penalties <ArrowUpDown className="pl-2" />
        </button>
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-right">{row.getValue("penalties")}</div>
    ),
  },
  {
    accessorKey: "totalEPA",
    header: ({ column }) => (
      <div className="flex justify-end">
        <button
          className="flex items-center hover:text-primary"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Total EPA <ArrowUpDown className="pl-2" />
        </button>
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-right">{row.getValue("totalEPA")}</div>
    ),
  },
];

export function EPATable({
  data,
  metrics,
}: {
  data?: AnalysisTableRow[];
  metrics?: AnalysisMetricDefinition[];
}) {
  const [selectedMetricKey, setSelectedMetricKey] =
    React.useState<string>("__none");
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  const tableData = React.useMemo(() => data ?? [], [data]);
  const availableMetrics = metrics || [];
  const selectedMetric = availableMetrics.find(
    (metric) => metric.key === selectedMetricKey,
  );

  const selectedMetricType = selectedMetric?.valueType;

  const tableDataWithMetric = React.useMemo(() => {
    if (!tableData.length) return tableData;

    return tableData.map((row) => {
      const rawValue =
        selectedMetricKey === "__none"
          ? row.totalEPA
          : (row.detailMetrics?.[selectedMetricKey] ?? 0);
      const displayValue =
        selectedMetricType === "rate"
          ? `${formatToTenths(rawValue)}%`
          : formatToTenths(rawValue);

      return {
        ...row,
        selectedMetric: displayValue,
        selectedMetricValue: rawValue,
      };
    });
  }, [tableData, selectedMetricKey, selectedMetricType]);

  const table = useReactTable({
    data: tableDataWithMetric,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="w-full">
      {/* Filter */}
      <div className="flex flex-wrap items-center gap-3 py-4">
        <Input
          placeholder="Filter teams..."
          value={(table.getColumn("team")?.getFilterValue() as string) ?? ""}
          onChange={(e) =>
            table.getColumn("team")?.setFilterValue(e.target.value)
          }
          className="max-w-sm"
        />

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select
            value={selectedMetricKey}
            onValueChange={(value) => {
              setSelectedMetricKey(value);
              setSorting([{ id: "selectedMetric", desc: true }]);
            }}
          >
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Choose scouting metric" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Total EPA</SelectItem>
              {availableMetrics.map((metric) => (
                <SelectItem key={metric.key} value={metric.key}>
                  {metric.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Filter /> Column Filters <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table
                .getAllColumns()
                .filter((col) => col.getCanHide())
                .map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    className="capitalize"
                    checked={col.getIsVisible()}
                    onCheckedChange={(v) => col.toggleVisibility(!!v)}
                  >
                    {col.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {cell.column.id === "auto" && (
                        <div className="text-right">
                          {formatToTenths(cell.getValue() as number)}
                        </div>
                      )}
                      {cell.column.id === "teleop" && (
                        <div className="text-right">
                          {formatToTenths(cell.getValue() as number)}
                        </div>
                      )}
                      {cell.column.id === "endgame" && (
                        <div className="text-right">
                          {formatToTenths(cell.getValue() as number)}
                        </div>
                      )}
                      {cell.column.id === "penalties" && (
                        <div className="text-right">
                          {formatToTenths(cell.getValue() as number)}
                        </div>
                      )}
                      {cell.column.id === "totalEPA" && (
                        <div className="text-right">
                          {formatToTenths(cell.getValue() as number)}
                        </div>
                      )}
                      {cell.column.id !== "auto" &&
                        cell.column.id !== "teleop" &&
                        cell.column.id !== "endgame" &&
                        cell.column.id !== "penalties" &&
                        cell.column.id !== "totalEPA" &&
                        flexRender(
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
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
