import { useEffect, useState } from "react";

export type TableSortDirection = "ASC" | "DESC";

export interface TableSortState {
  sortColumn: string | undefined;
  sortDirection: TableSortDirection;
  handleSort: (columnName: string) => void;
}

export function useTableSort(defaultColumn: string | undefined): TableSortState {
  const [sortColumn, setSortColumn] = useState<string | undefined>(defaultColumn);
  const [sortDirection, setSortDirection] = useState<TableSortDirection>("DESC");

  useEffect(() => {
    if (!defaultColumn) {
      return;
    }
    setSortColumn((current) => current ?? defaultColumn);
  }, [defaultColumn]);

  const handleSort = (columnName: string) => {
    if (sortColumn === columnName) {
      setSortDirection((prev) => (prev === "ASC" ? "DESC" : "ASC"));
      return;
    }
    setSortColumn(columnName);
    setSortDirection("ASC");
  };

  return { sortColumn, sortDirection, handleSort };
}
