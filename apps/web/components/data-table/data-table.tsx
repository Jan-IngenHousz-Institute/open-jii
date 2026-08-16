"use client";

import { isEditableTarget } from "@/components/shortcuts/is-editable-target";
import { showShortcutHint } from "@/components/shortcuts/use-shortcut-hint";
import { useHotkey } from "@tanstack/react-hotkeys";
import type { OnChangeFn, PaginationState, RowSelectionState } from "@tanstack/react-table";
import { getCoreRowModel, getPaginationRowModel, useReactTable } from "@tanstack/react-table";
import React, { useCallback, useMemo, useState } from "react";

import type { ExperimentAnnotationType } from "@repo/api/domains/experiment/data-annotations/experiment-data-annotations.schema";
import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { useTranslation } from "@repo/i18n";
import { Checkbox } from "@repo/ui/components/checkbox";
import { Label } from "@repo/ui/components/label";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@repo/ui/components/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Table, TableBody } from "@repo/ui/components/table";
import { cn } from "@repo/ui/lib/utils";

import { createTableColumns, sortColumnsForDisplay } from "./data-table-columns";
import type { DataRow } from "./data-table-columns";
import { DataTableHeader, DataTableRows, formatValue, LoadingRows } from "./data-table-utils";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

interface PaginationConfig {
  state: PaginationState;
  onChange: OnChangeFn<PaginationState>;
  totalRows: number;
  totalPages: number;
}

interface SortingConfig {
  column?: string;
  direction: "ASC" | "DESC";
  onSort: (columnName: string, columnType?: string) => void;
}

interface SelectionConfig {
  state: RowSelectionState;
  onChange: OnChangeFn<RowSelectionState>;
}

interface CellHandlers {
  onChartClick?: (data: number[], columnName: string) => void;
  onAddAnnotation?: (rowIds: string[], type: ExperimentAnnotationType) => void;
  onDeleteAnnotations?: (rowIds: string[], type: ExperimentAnnotationType) => void;
}

export interface DataTableProps {
  /** Warehouse column metadata; the type decides how each cell renders. */
  columns: ExperimentDataColumn[];
  rows: DataRow[];
  isLoading?: boolean;
  /** Filters, bulk actions, anything the surface puts above its table. */
  toolbar?: React.ReactNode;
  /** Paging owned by the caller (server-driven); omit to show every row given. */
  pagination?: PaginationConfig;
  sorting?: SortingConfig;
  selection?: SelectionConfig;
  cellHandlers?: CellHandlers;
  errorColumn?: string;
  /** Rows rendered as skeletons while a page is in flight. */
  loadingRowCount?: number;
  className?: string;
}

/**
 * A table over warehouse-shaped rows: columns carry their DB type, and each
 * cell renders by that type (numbers right-aligned, arrays as sparklines,
 * structs and variants as expandable JSON). Nothing here is experiment-
 * specific; the caller owns where the rows came from and what sits in the
 * toolbar.
 */
export function DataTable({
  columns,
  rows,
  isLoading = false,
  toolbar,
  pagination,
  sorting,
  selection,
  cellHandlers,
  errorColumn,
  loadingRowCount = 10,
  className,
}: DataTableProps) {
  const { t } = useTranslation();
  const [expandedCell, setExpandedCell] = useState<{ rowId: string; columnName: string } | null>(
    null,
  );

  const toggleCellExpansion = useCallback((rowId: string, columnName: string) => {
    setExpandedCell((previous) =>
      previous?.rowId === rowId && previous.columnName === columnName
        ? null
        : { rowId, columnName },
    );
  }, []);

  const isCellExpanded = useCallback(
    (rowId: string, columnName: string) =>
      expandedCell?.rowId === rowId && expandedCell.columnName === columnName,
    [expandedCell],
  );

  const orderedColumns = useMemo(() => sortColumnsForDisplay(columns), [columns]);

  const tableColumns = useMemo(() => {
    const dataColumns = createTableColumns({
      columns,
      formatFunction: formatValue,
      onChartClick: cellHandlers?.onChartClick,
      onAddAnnotation: cellHandlers?.onAddAnnotation,
      onDeleteAnnotations: cellHandlers?.onDeleteAnnotations,
      onToggleCellExpansion: toggleCellExpansion,
      isCellExpanded,
      errorColumn,
    });

    return selection === undefined ? dataColumns : [selectionColumn(), ...dataColumns];
  }, [columns, cellHandlers, toggleCellExpansion, isCellExpanded, errorColumn, selection]);

  const table = useReactTable<DataRow>({
    data: rows,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: pagination !== undefined,
    enableRowSelection: selection !== undefined,
    getRowId: (row) => String(row.id),
    onRowSelectionChange: selection?.onChange,
    onPaginationChange: pagination?.onChange,
    rowCount: pagination?.totalRows,
    state: {
      ...(pagination ? { pagination: pagination.state } : {}),
      ...(selection ? { rowSelection: selection.state } : {}),
    },
    defaultColumn: { size: 180 },
  });

  useHotkey(
    "ArrowRight",
    (event) => {
      if (isEditableTarget(document.activeElement) || isEditableTarget(event.target)) return;
      if (!table.getCanNextPage()) return;
      event.preventDefault();
      table.nextPage();
      showShortcutHint({ keys: ["→"], label: "Next page" });
    },
    { preventDefault: false, stopPropagation: false },
  );

  useHotkey(
    "ArrowLeft",
    (event) => {
      if (isEditableTarget(document.activeElement) || isEditableTarget(event.target)) return;
      if (!table.getCanPreviousPage()) return;
      event.preventDefault();
      table.previousPage();
      showShortcutHint({ keys: ["←"], label: "Previous page" });
    },
    { preventDefault: false, stopPropagation: false },
  );

  return (
    <div className={cn("grid max-w-full", className)}>
      {toolbar}

      <div className="text-muted-foreground relative -mt-px overflow-x-auto rounded-b-lg border">
        <Table className="w-max min-w-full">
          <DataTableHeader
            headerGroups={table.getHeaderGroups()}
            sortColumn={sorting?.column}
            sortDirection={sorting?.direction}
            onSort={sorting?.onSort}
          />
          <TableBody>
            {isLoading ? (
              <LoadingRows columnCount={tableColumns.length} rowCount={loadingRowCount} />
            ) : (
              <DataTableRows
                rows={table.getRowModel().rows}
                columnCount={tableColumns.length}
                expandedCell={expandedCell}
                tableRows={rows}
                columns={orderedColumns}
                errorColumn={errorColumn}
              />
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && (
        <div className="mt-4 flex w-full flex-col items-center justify-between gap-4 overflow-auto p-1 text-sm sm:flex-row sm:gap-8">
          <div className="flex-1 whitespace-nowrap">
            {t("dataTable.totalRows")}: {pagination.totalRows}
          </div>
          <div className="flex items-center space-x-2">
            <Label className="whitespace-nowrap">{t("dataTable.rowsPerPage")}:</Label>
            <Select
              value={pagination.state.pageSize.toString()}
              onValueChange={(rowsPerPage) => {
                table.setPageSize(Number(rowsPerPage));
              }}
            >
              <SelectTrigger className="w-[65px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Pagination className="max-w-72">
            <PaginationContent className="w-full justify-between">
              <PaginationItem>
                <PaginationPrevious
                  className={cn(
                    "border",
                    !table.getCanPreviousPage() &&
                      "pointer-events-none cursor-not-allowed opacity-50",
                  )}
                  onClick={() => {
                    table.previousPage();
                  }}
                  aria-disabled={!table.getCanPreviousPage()}
                  title={t("dataTable.previous")}
                />
              </PaginationItem>
              <PaginationItem>
                <span>
                  {t("dataTable.page")} {pagination.state.pageIndex + 1} {t("dataTable.pageOf")}{" "}
                  {pagination.totalPages}
                </span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  className={cn(
                    "border",
                    !table.getCanNextPage() && "pointer-events-none cursor-not-allowed opacity-50",
                  )}
                  onClick={() => {
                    table.nextPage();
                  }}
                  aria-disabled={!table.getCanNextPage()}
                  title={t("dataTable.next")}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}

/** Row checkboxes, present only for callers that own a selection state. */
function selectionColumn() {
  return {
    id: "select",
    accessorKey: "select",
    size: 50,
    header: ({
      table,
    }: {
      table: {
        getIsAllPageRowsSelected: () => boolean;
        getIsSomePageRowsSelected: () => boolean;
        toggleAllPageRowsSelected: (value: boolean) => void;
      };
    }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected()
            ? true
            : table.getIsSomePageRowsSelected()
              ? "indeterminate"
              : false
        }
        onCheckedChange={(value) => {
          table.toggleAllPageRowsSelected(!!value);
        }}
        aria-label="Select all"
      />
    ),
    cell: ({
      row,
    }: {
      row: { getIsSelected: () => boolean; toggleSelected: (value: boolean) => void };
    }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => {
          row.toggleSelected(!!value);
        }}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  };
}
