import type { AccessorKeyColumnDef } from "@tanstack/react-table";

import type { DataRow } from "../../../../hooks/experiment/useExperimentData/useExperimentData";

const MAX_COLUMN_WIDTH = 120;

type SizedColumn = AccessorKeyColumnDef<DataRow, unknown>;

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

function capColumnWidths(columns: SizedColumn[]): SizedColumn[] {
  return columns.map((col) => ({
    ...col,
    size: col.size ? Math.min(col.size, MAX_COLUMN_WIDTH) : MAX_COLUMN_WIDTH,
  }));
}
