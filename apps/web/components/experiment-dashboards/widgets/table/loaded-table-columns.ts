import type { DataTableFeatures } from "@/components/data-table/data-table-features";
import type { AccessorKeyColumnDef } from "@tanstack/react-table";
import type { DataRow } from "~/components/data-table/data-table-columns";

const MAX_COLUMN_WIDTH = 120;

type SizedColumn = AccessorKeyColumnDef<DataTableFeatures, DataRow, unknown>;

export function projectAndOrderColumns(
  metadataColumns: SizedColumn[] | undefined,
  selectedColumns: string[] | undefined,
): SizedColumn[] {
  const sized = capColumnWidths(metadataColumns ?? []);

  if (!selectedColumns) {
    return sized;
  }
  if (selectedColumns.length === 0) {
    return [];
  }

  const orderByName = new Map(selectedColumns.map((name, index) => [name, index] as const));
  return sized
    .filter((col) => orderByName.has(String(col.accessorKey)))
    .sort((a, b) => {
      const orderA = orderByName.get(String(a.accessorKey)) ?? 0;
      const orderB = orderByName.get(String(b.accessorKey)) ?? 0;
      return orderA - orderB;
    });
}

/**
 * The columns a page of the widget reads: the ones it shows, plus the columns it sorts by and flags
 * errors with. Nothing selected means every column.
 */
export function readColumnsFor(
  selectedColumns: string[] | undefined,
  sortColumn: string | undefined,
  errorColumn: string | undefined,
): string[] | undefined {
  if (!selectedColumns || selectedColumns.length === 0) {
    return undefined;
  }
  const needed = [...selectedColumns, sortColumn, errorColumn];
  return [...new Set(needed.filter((name): name is string => Boolean(name)))];
}

function capColumnWidths(columns: SizedColumn[]): SizedColumn[] {
  return columns.map((col) => ({
    ...col,
    size: col.size ? Math.min(col.size, MAX_COLUMN_WIDTH) : MAX_COLUMN_WIDTH,
  }));
}
