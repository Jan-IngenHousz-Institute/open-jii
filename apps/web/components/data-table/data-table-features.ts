import {
  columnSizingFeature,
  columnVisibilityFeature,
  createPaginatedRowModel,
  rowPaginationFeature,
  rowSelectionFeature,
  tableFeatures,
} from "@tanstack/react-table";

/**
 * Static capabilities shared by warehouse-data tables and their reusable
 * column/header/row renderers. Unpaged consumers opt into manual pagination so
 * the registered page model never truncates their rows.
 */
export const dataTableFeatures = tableFeatures({
  columnSizingFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
  rowSelectionFeature,
});

export type DataTableFeatures = typeof dataTableFeatures;
