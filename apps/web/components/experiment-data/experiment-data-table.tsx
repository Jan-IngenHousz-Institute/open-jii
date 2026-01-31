"use client";

import type {
  DataRow,
  TableMetadata,
} from "@/hooks/experiment/useExperimentData/useExperimentData";
import { useExperimentData } from "@/hooks/experiment/useExperimentData/useExperimentData";
import { zodResolver } from "@hookform/resolvers/zod";
import type { PaginationState, Updater } from "@tanstack/react-table";
import { getCoreRowModel, getPaginationRowModel, useReactTable } from "@tanstack/react-table";
import React, { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import z from "zod";
import { AddAnnotationDialog } from "~/components/experiment-data/annotations/add-annotation-dialog";
import { BulkActionsBar } from "~/components/experiment-data/annotations/bulk-actions-bar";
import { DeleteAnnotationsDialog } from "~/components/experiment-data/annotations/delete-annotations-dialog";
import {
  ExperimentDataRows,
  ExperimentTableHeader,
  formatValue,
  LoadingRows,
} from "~/components/experiment-data/experiment-data-utils";

import type { AnnotationType } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Checkbox,
  Form,
  Label,
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Table,
  TableBody,
} from "@repo/ui/components";
import { cn } from "@repo/ui/lib/utils";

import { DataDownloadModal } from "./data-download-modal/data-download-modal";
import { ExperimentDataTableErrorCell } from "./table-cells/error/experiment-data-table-error-cell";
import { ExperimentDataTableChart } from "./table-chart/experiment-data-table-chart";

// Helper function to map column names for sorting
function getSortColumnName(columnName: string, columnType?: string): string {
  // For USER columns, sort by user_name instead of the column name
  if (columnType === "USER") {
    return "user_name";
  }
  return columnName;
}

const bulkSelectionFormSchema = z.object({
  selectedRowIds: z.array(z.string()),
});
export type BulkSelectionFormType = z.infer<typeof bulkSelectionFormSchema>;

export function ExperimentDataTable({
  experimentId,
  tableName,
  pageSize = 10,
  displayName,
  defaultSortColumn,
  errorColumn,
}: {
  experimentId: string;
  tableName: string;
  pageSize: number;
  displayName?: string;
  defaultSortColumn?: string;
  errorColumn?: string;
}) {
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize });
  const [persistedMetaData, setPersistedMetaData] = useState<TableMetadata>();
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [sortColumn, setSortColumn] = useState<string | undefined>(defaultSortColumn);
  const [sortDirection, setSortDirection] = useState<"ASC" | "DESC">("DESC");

  // Annotation dialog states
  const [addAnnotationDialogOpen, setAddAnnotationDialogOpen] = useState(false);
  const [addAnnotationRowIds, setAddAnnotationRowIds] = useState<string[]>([]);
  const [addAnnotationType, setAddAnnotationType] = useState<AnnotationType>("comment");
  const [deleteAnnotationsDialogOpen, setDeleteAnnotationsDialogOpen] = useState(false);
  const [deleteAnnotationRowIds, setDeleteAnnotationRowIds] = useState<string[]>([]);
  const [deleteAnnotationType, setDeleteAnnotationType] = useState<AnnotationType>("comment");

  // Row selection state (TanStack Table)
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  // Form to track selection for bulk actions
  const selectionForm = useForm<BulkSelectionFormType>({
    resolver: zodResolver(bulkSelectionFormSchema),
    defaultValues: { selectedRowIds: [] },
  });

  // Chart state
  const [chartDisplay, setChartDisplay] = useState<{
    data: number[];
    columnName: string;
    isPinned: boolean;
  } | null>(null);

  // Expandable cell state - tracks which row+column combination is expanded
  // Key format: "rowId:columnName"
  const [expandedCells, setExpandedCells] = useState<Record<string, boolean>>({});

  const { t } = useTranslation();

  // Remove hover functionality - chart only shows on click

  // Toggle chart pinning on click
  const toggleChartPin = useCallback((data: number[], columnName: string) => {
    setChartDisplay((prev) => {
      // If clicking the same pinned chart, unpin it
      if (prev?.isPinned && prev.columnName === columnName) {
        return null;
      }
      // Otherwise, pin this chart
      return { data, columnName, isPinned: true };
    });
  }, []);

  // Close pinned chart
  const closePinnedChart = useCallback(() => {
    setChartDisplay(null);
  }, []);

  // Expandable cell handlers
  const toggleCellExpansion = useCallback((rowId: string, columnName: string) => {
    const key = `${rowId}:${columnName}`;
    setExpandedCells((prev) => (prev[key] ? { ...prev, [key]: false } : { [key]: true }));
  }, []);

  const isCellExpanded = useCallback(
    (rowId: string, columnName: string) => {
      const key = `${rowId}:${columnName}`;
      return expandedCells[key] || false;
    },
    [expandedCells],
  );

  // Annotation dialog handlers
  const openAddAnnotationDialog = useCallback(
    (rowIds: string[], type: AnnotationType = "comment") => {
      setAddAnnotationRowIds(rowIds);
      setAddAnnotationType(type);
      setAddAnnotationDialogOpen(true);
    },
    [],
  );

  const openDeleteAnnotationsDialog = useCallback(
    (rowIds: string[], type: AnnotationType = "comment") => {
      setDeleteAnnotationRowIds(rowIds);
      setDeleteAnnotationType(type);
      setDeleteAnnotationsDialogOpen(true);
    },
    [],
  );

  // Toggle sorting for a column
  const handleSort = useCallback(
    (columnName: string, columnType?: string) => {
      const actualSortColumn = getSortColumnName(columnName, columnType);
      if (sortColumn === actualSortColumn) {
        // Toggle direction if same column
        setSortDirection((prev) => (prev === "ASC" ? "DESC" : "ASC"));
      } else {
        // New column, default to ASC
        setSortColumn(actualSortColumn);
        setSortDirection("ASC");
      }
    },
    [sortColumn],
  );

  // Use traditional pagination with improved column persistence
  const { tableMetadata, tableRows, isLoading, error } = useExperimentData(
    experimentId,
    pagination.pageIndex + 1,
    pagination.pageSize,
    tableName,
    sortColumn,
    sortDirection,
    formatValue,
    toggleChartPin,
    openAddAnnotationDialog,
    openDeleteAnnotationsDialog,
    toggleCellExpansion,
    isCellExpanded,
    errorColumn,
  );

  const onPaginationChange = useCallback(
    (updaterOrValue: Updater<PaginationState>) => {
      if (typeof updaterOrValue === "function") {
        const newPagination = updaterOrValue(pagination);
        setPagination(newPagination);
      } else {
        setPagination(updaterOrValue);
      }
      // Clear selection on page change
      setRowSelection({});
    },
    [pagination],
  );

  function changePageSize(pageSize: number) {
    const newPagination = { pageIndex: 0, pageSize };
    setPagination(newPagination);
  }

  // Update persisted metadata when we get new data
  useEffect(() => {
    if (tableMetadata) {
      setPersistedMetaData(tableMetadata);
    }
  }, [tableMetadata]);

  const columnCount = persistedMetaData?.columns.length ?? 0;
  const totalPages = persistedMetaData?.totalPages ?? 0;
  const totalRows = persistedMetaData?.totalRows ?? 0;

  // Create columns with checkbox column
  const columns = React.useMemo(() => {
    if (!persistedMetaData?.columns) return [];

    return [
      {
        id: "select",
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
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
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
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      ...persistedMetaData.columns,
    ];
  }, [persistedMetaData?.columns]);

  const table = useReactTable<DataRow>({
    data: tableRows ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    enableRowSelection: true,
    getRowId: (row, index) => `${pagination.pageIndex}-${index}`,
    onRowSelectionChange: setRowSelection,
    onPaginationChange,
    state: {
      pagination,
      rowSelection,
    },
    rowCount: totalRows,
    defaultColumn: {
      size: 180,
    },
  });

  // Derive selected row IDs from table state
  const selectedRowIds = Object.keys(rowSelection);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" && table.getCanNextPage()) {
        table.nextPage();
      }

      if (event.key === "ArrowLeft" && table.getCanPreviousPage()) {
        table.previousPage();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [table]);

  if (isLoading && !persistedMetaData) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-7 w-48" />
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          {Array.from({ length: pageSize }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-64" />
        </div>
      </div>
    );
  }

  if (error) {
    return <div>{t("experimentDataTable.error")}</div>;
  }

  if (!tableRows && !isLoading) {
    return <div>{t("experimentDataTable.noData")}</div>;
  }

  // Calculate column count for empty state
  const loadingRowCount =
    pagination.pageIndex + 1 == totalPages ? totalRows % pagination.pageSize : pagination.pageSize;

  return (
    <Form {...selectionForm}>
      <form>
        <h5 className="mb-3 text-base font-medium">{displayName}</h5>
        <BulkActionsBar
          rowIds={selectedRowIds}
          tableRows={tableRows}
          downloadTable={() => setDownloadModalOpen(true)}
          onAddAnnotation={openAddAnnotationDialog}
          onDeleteAnnotations={openDeleteAnnotationsDialog}
        />
        <div className="text-muted-foreground relative -mt-px overflow-x-auto rounded-b-lg border">
          <Table className="w-max min-w-full">
            <ExperimentTableHeader
              headerGroups={table.getHeaderGroups()}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
            <TableBody>
              {isLoading && persistedMetaData && (
                <LoadingRows columnCount={columnCount} rowCount={loadingRowCount} />
              )}
              {!isLoading && (
                <ExperimentDataRows
                  rows={table.getRowModel().rows}
                  columnCount={columnCount}
                  expandedCells={expandedCells}
                  tableRows={tableRows}
                  columns={persistedMetaData?.rawColumns ?? []}
                  errorColumn={errorColumn}
                />
              )}
            </TableBody>
          </Table>
        </div>
        {/* Traditional pagination controls */}
        <div className="mt-4 flex w-full flex-col items-center justify-between gap-4 overflow-auto p-1 text-sm sm:flex-row sm:gap-8">
          <div className="flex-1 whitespace-nowrap">
            {t("experimentDataTable.totalRows")}: {totalRows}
          </div>
          <div className="flex items-center space-x-2">
            <Label className="whitespace-nowrap">{t("experimentDataTable.rowsPerPage")}:</Label>
            <Select
              value={pagination.pageSize.toString()}
              onValueChange={(rowsPerPage) => changePageSize(+rowsPerPage)}
            >
              <SelectTrigger className="w-[65px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
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
                  onClick={() => table.previousPage()}
                  aria-disabled={!table.getCanPreviousPage()}
                  title={t("experimentDataTable.previous")}
                />
              </PaginationItem>
              <PaginationItem>
                <span className="">
                  {t("experimentDataTable.page")} {pagination.pageIndex + 1}{" "}
                  {t("experimentDataTable.pageOf")} {totalPages}
                </span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  className={cn(
                    "border",
                    !table.getCanNextPage() && "pointer-events-none cursor-not-allowed opacity-50",
                  )}
                  onClick={() => table.nextPage()}
                  aria-disabled={!table.getCanNextPage()}
                  title={t("experimentDataTable.next")}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
        <DataDownloadModal
          experimentId={experimentId}
          tableName={tableName}
          open={downloadModalOpen}
          onOpenChange={setDownloadModalOpen}
        />
        {chartDisplay && (
          <div id="experiment-data-chart" className="mt-6">
            <ExperimentDataTableChart
              data={chartDisplay.data}
              columnName={chartDisplay.columnName}
              visible={true}
              isClicked={chartDisplay.isPinned}
              onClose={closePinnedChart}
            />
          </div>
        )}
      </form>
      <AddAnnotationDialog
        experimentId={experimentId}
        tableName={tableName}
        rowIds={addAnnotationRowIds}
        type={addAnnotationType}
        open={addAnnotationDialogOpen}
        setOpen={setAddAnnotationDialogOpen}
        clearSelection={() => setRowSelection({})}
      />
      <DeleteAnnotationsDialog
        experimentId={experimentId}
        tableName={tableName}
        rowIds={deleteAnnotationRowIds}
        type={deleteAnnotationType}
        open={deleteAnnotationsDialogOpen}
        setOpen={setDeleteAnnotationsDialogOpen}
        clearSelection={() => setRowSelection({})}
      />
    </Form>
  );
}
