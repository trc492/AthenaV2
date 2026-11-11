import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_text,
  tableFeatures,
} from "@tanstack/react-table";

// Only the built-ins our columns resolve, by name or through "auto".
const filterFns = { includesString: filterFn_includesString };
const sortFns = { alphanumeric: sortFn_alphanumeric, text: sortFn_text };

export const scoutingTableFeatures = tableFeatures({
  columnFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  filterFns,
  sortFns,
});
export type ScoutingTableFeatures = typeof scoutingTableFeatures;

export const epaTableFeatures = tableFeatures({
  columnFilteringFeature,
  rowSortingFeature,
  columnVisibilityFeature,
  rowSelectionFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  filterFns,
  sortFns,
});
export type EPATableFeatures = typeof epaTableFeatures;
