"use client";

import type {
  DataRow,
  TableMetadata,
} from "@/hooks/experiment/useExperimentData/useExperimentData";
import { useExperimentData } from "@/hooks/experiment/useExperimentData/useExperimentData";
import type { PaginationState, RowSelectionState, Updater } from "@tanstack/react-table";
import { getCoreRowModel, getPaginationRowModel, useReactTable } from "@tanstack/react-table";
import React, { useCallback, useEffect, useState } from "react";
import { BulkActionsBar } from "~/components/experiment-data/comments/bulk-actions-bar";
import {
  ExperimentDataRows,
  ExperimentTableHeader,
  formatValue,
  LoadingRows,
} from "~/components/experiment-data/experiment-data-utils";
import { renderIntoElement } from "~/util/reactUtil";

import type { ExperimentDataComment } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Checkbox,
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
  Table,
  TableBody,
} from "@repo/ui/components";
import { cn } from "@repo/ui/lib/utils";

import { DataDownloadModal } from "./data-download-modal/data-download-modal";
import { ExperimentDataTableChart } from "./experiment-data-table-chart";

export function ExperimentDataTable({
  experimentId,
  tableName,
  pageSize = 10,
}: {
  experimentId: string;
  tableName: string;
  pageSize: number;
}) {
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize });
  const [persistedMetaData, setPersistedMetaData] = useState<TableMetadata>();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);

  // Chart state - much simpler
  const [chartDisplay, setChartDisplay] = useState<{
    data: number[];
    columnName: string;
    isPinned: boolean;
  } | null>(null);

  const { t } = useTranslation();

  // Show chart on hover (only if not pinned)
  const showChartOnHover = useCallback((data: number[], columnName: string) => {
    setChartDisplay((current) => {
      if (current?.isPinned) return current;
      return { data, columnName, isPinned: false };
    });
  }, []);

  // Hide chart on leave (only if not pinned)
  const hideChartOnLeave = useCallback(() => {
    setChartDisplay((current) => {
      if (current?.isPinned) return current;
      return null;
    });
  }, []);

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

  // Use traditional pagination with improved column persistence
  const { tableMetadata, tableRows, isLoading, error } = useExperimentData({
    experimentId,
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    tableName,
    formatFunction: formatValue,
    commentsColumnName: t("experimentDataComments.columnHeader"),
    onChartHover: showChartOnHover,
    onChartLeave: hideChartOnLeave,
    onChartClick: toggleChartPin,
  });

  function clearSelection() {
    setRowSelection({});
  }

  const onPaginationChange = useCallback(
    (updaterOrValue: Updater<PaginationState>) => {
      if (typeof updaterOrValue === "function") {
        const newPagination = updaterOrValue(pagination);
        setPagination(newPagination);
        clearSelection();
      } else {
        setPagination(updaterOrValue);
        clearSelection();
      }
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

  const table = useReactTable<DataRow>({
    data: tableRows ?? [],
    columns: persistedMetaData?.columns ?? [],
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    onPaginationChange,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    getRowId: (originalRow: DataRow, index: number) => {
      if (originalRow.id) return originalRow.id;
      return index.toString();
    },
    state: {
      pagination,
      rowSelection,
    },
    rowCount: totalRows,
    defaultColumn: {
      size: 180,
    },
  });

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

  useEffect(() => {
    function getPageRowsSelectedCheckedState() {
      return table.getIsSomePageRowsSelected() ? "indeterminate" : table.getIsAllPageRowsSelected();
    }

    const toggleAll = document.getElementById("rowToggleAll");
    if (toggleAll) {
      renderIntoElement(
        toggleAll,
        <Checkbox
          checked={getPageRowsSelectedCheckedState()}
          onCheckedChange={() => table.toggleAllPageRowsSelected()}
        />,
      );
    }
  }, [persistedMetaData, table, rowSelection]);

  function getSelectedNumberOfCommentsAndFlags() {
    if (!tableRows) return { totalSelectedComments: 0, totalSelectedFlags: 0 };

    return tableRows
      .filter((row) => row.id && row.comments && Object.keys(rowSelection).includes(row.id))
      .flatMap((row) => JSON.parse(row.comments ?? "[]") as ExperimentDataComment[])
      .reduce(
        (acc, comment) => ({
          totalSelectedComments: acc.totalSelectedComments + (comment.flag === undefined ? 1 : 0),
          totalSelectedFlags: acc.totalSelectedFlags + (comment.flag !== undefined ? 1 : 0),
        }),
        { totalSelectedComments: 0, totalSelectedFlags: 0 },
      );
  }

  if (isLoading && !persistedMetaData) {
    return <div>{t("experimentDataTable.loading")}</div>;
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

  const { totalSelectedComments, totalSelectedFlags } = getSelectedNumberOfCommentsAndFlags();
  const rowIds = Object.keys(rowSelection);

  return (
    <div>
      <h5 className="mb-4 text-base font-medium">
        {t("experimentDataTable.table")} {tableName}
      </h5>
      <BulkActionsBar
        experimentId={experimentId}
        tableName={tableName}
        rowIds={rowIds}
        totalComments={totalSelectedComments}
        totalFlags={totalSelectedFlags}
        clearSelection={clearSelection}
        downloadTable={() => setDownloadModalOpen(true)}
      />
      <div className="text-muted-foreground rounded-md border">
        <Table>
          <ExperimentTableHeader headerGroups={table.getHeaderGroups()} />
          <TableBody>
            {isLoading && persistedMetaData && (
              <LoadingRows columnCount={columnCount} rowCount={loadingRowCount} />
            )}
            {!isLoading && (
              <ExperimentDataRows rows={table.getRowModel().rows} columnCount={columnCount} />
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
        <div className="mt-6">
          <ExperimentDataTableChart
            data={chartDisplay.data}
            columnName={chartDisplay.columnName}
            visible={true}
            isClicked={chartDisplay.isPinned}
            onClose={closePinnedChart}
          />
        </div>
      )}
    </div>
  );
}
