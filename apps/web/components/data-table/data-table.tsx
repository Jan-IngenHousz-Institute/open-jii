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

/**
 * Paging a caller drives itself, because the rows come a page at a time from
 * the server and only it knows the totals.
 */
interface ServerPaginationConfig {
  mode: "server";
  state: PaginationState;
  onChange: OnChangeFn<PaginationState>;
  totalRows: number;
  totalPages: number;
  pageSizeOptions?: number[];
}

/** Paging over rows the table already holds; it owns the page state. */
interface ClientPaginationConfig {
  mode: "client";
  pageSize?: number;
  pageSizeOptions?: number[];
}

type PaginationConfig = ServerPaginationConfig | ClientPaginationConfig;

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

  const isPaged = pagination !== undefined;
  const isServerPaged = pagination?.mode === "server";

  const [clientPagination, setClientPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: pagination?.mode === "client" ? (pagination.pageSize ?? 10) : 10,
  });

  const pageState = pagination?.mode === "server" ? pagination.state : clientPagination;
  const totalRows = pagination?.mode === "server" ? pagination.totalRows : rows.length;
  const totalPages =
    pagination?.mode === "server"
      ? pagination.totalPages
      : Math.max(1, Math.ceil(rows.length / pageState.pageSize));
  const pageSizeOptions = pagination?.pageSizeOptions ?? PAGE_SIZE_OPTIONS;

  const table = useReactTable<DataRow>({
    data: rows,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    // Without a paging model every row renders. Supplying one unpaged would
    // silently cut the table at tanstack's default page size.
    ...(isPaged ? { getPaginationRowModel: getPaginationRowModel() } : {}),
    manualPagination: isServerPaged,
    enableRowSelection: selection !== undefined,
    getRowId: (row) => String(row.id),
    onRowSelectionChange: selection?.onChange,
    onPaginationChange: pagination?.mode === "server" ? pagination.onChange : setClientPagination,
    rowCount: totalRows,
    state: {
      ...(isPaged ? { pagination: pageState } : {}),
      ...(selection ? { rowSelection: selection.state } : {}),
    },
    defaultColumn: { size: 180 },
  });

  useHotkey(
    "ArrowRight",
    (event) => {
      if (!isPaged) return;
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
      if (!isPaged) return;
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

      <div
        className={cn(
          "text-muted-foreground @container relative overflow-x-auto border",
          // The overlap and the squared top edge exist to meet a toolbar's
          // bottom border; standalone, the table draws its own.
          toolbar === undefined ? "rounded-lg" : "-mt-px rounded-b-lg",
        )}
      >
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

      {isPaged && (
        <div className="mt-4 flex w-full flex-col items-center justify-between gap-4 overflow-auto p-1 text-sm sm:flex-row sm:gap-8">
          <div className="flex-1 whitespace-nowrap">
            {t("dataTable.totalRows")}: {totalRows}
          </div>
          <div className="flex items-center space-x-2">
            <Label className="whitespace-nowrap">{t("dataTable.rowsPerPage")}:</Label>
            <Select
              value={pageState.pageSize.toString()}
              onValueChange={(rowsPerPage) => {
                table.setPageSize(Number(rowsPerPage));
              }}
            >
              <SelectTrigger className="w-[65px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
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
                  {t("dataTable.page")} {pageState.pageIndex + 1} {t("dataTable.pageOf")}{" "}
                  {totalPages}
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
