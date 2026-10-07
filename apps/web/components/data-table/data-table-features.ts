import {
  columnSizingFeature,
  columnVisibilityFeature,
  createPaginatedRowModel,
  metaHelper,
  rowPaginationFeature,
  rowSelectionFeature,
  tableFeatures,
} from "@tanstack/react-table";

import type { IsCellExpandedFn } from "./data-table-columns";

/** What a cell reads from its table each render, so the column definitions need not change. */
interface DataTableMeta {
  isCellExpanded?: IsCellExpandedFn;
}

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
  tableMeta: metaHelper<DataTableMeta>(),
});

export type DataTableFeatures = typeof dataTableFeatures;
