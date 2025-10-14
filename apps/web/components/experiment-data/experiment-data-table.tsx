"use client";

import type {
  DataRow,
  TableMetadata,
} from "@/hooks/experiment/useExperimentData/useExperimentData";
import { useExperimentData } from "@/hooks/experiment/useExperimentData/useExperimentData";
import { zodResolver } from "@hookform/resolvers/zod";
import type { PaginationState, Updater } from "@tanstack/react-table";
import { getCoreRowModel, getPaginationRowModel, useReactTable } from "@tanstack/react-table";
import { Download } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import z from "zod";
import { BulkActionsBar } from "~/components/experiment-data/annotations/bulk-actions-bar";
import { getTotalSelectedCounts } from "~/components/experiment-data/annotations/utils";
import {
  ExperimentDataRows,
  ExperimentTableHeader,
  formatValue,
  LoadingRows,
} from "~/components/experiment-data/experiment-data-utils";

import { useTranslation } from "@repo/i18n";
import {
  Button,
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
  Table,
  TableBody,
} from "@repo/ui/components";
import { cn } from "@repo/ui/lib/utils";

import { DataDownloadModal } from "./data-download-modal/data-download-modal";
import { ExperimentDataTableChart } from "./experiment-data-table-chart";

const bulkSelectionFormSchema = z.object({
  allRows: z.array(z.string()),
  selectedRowId: z.array(z.string()),
  selectAll: z.boolean().optional(),
});
export type BulkSelectionFormType = z.infer<typeof bulkSelectionFormSchema>;

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
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);

  // Row selection state - for bulk actions
  const selectionForm = useForm<BulkSelectionFormType>({
    resolver: zodResolver(bulkSelectionFormSchema),
    defaultValues: { selectedRowId: [], allRows: [] },
  });

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
  const { tableMetadata, tableRows, isLoading, error } = useExperimentData(
    experimentId,
    pagination.pageIndex + 1,
    pagination.pageSize,
    tableName,
    formatValue,
    showChartOnHover,
    hideChartOnLeave,
    toggleChartPin,
    selectionForm,
  );

  const onPaginationChange = useCallback(
    (updaterOrValue: Updater<PaginationState>) => {
      if (typeof updaterOrValue === "function") {
        const newPagination = updaterOrValue(pagination);
        setPagination(newPagination);
        selectionForm.setValue("selectedRowId", []); // Clear selection on page change
      } else {
        setPagination(updaterOrValue);
        selectionForm.setValue("selectedRowId", []); // Clear selection on page change
      }
    },
    [pagination, selectionForm],
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
    state: {
      pagination,
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

  const selectedRowIds = useWatch({ control: selectionForm.control, name: "selectedRowId" });

  const { totalSelectedComments, totalSelectedFlags } = useMemo(() => {
    return getTotalSelectedCounts(tableRows, selectedRowIds);
  }, [selectedRowIds, tableRows]);

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

  const isBulkActionsEnabled = selectionForm.getValues("allRows").length > 0;

  return (
    <Form {...selectionForm}>
      <form>
        <input type="hidden" name="allRows" />
        {/*TODO: The option with bulk actions will be removed as soon as the backend code is ready.*/}
        {!isBulkActionsEnabled && (
          <div className="mb-4 flex items-center justify-between">
            <h5 className="text-base font-medium">
              {t("experimentDataTable.table")} {tableName}
            </h5>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setDownloadModalOpen(true)}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {t("experimentDataTable.download")}
            </Button>
          </div>
        )}
        {isBulkActionsEnabled && (
          <>
            <h5 className="text-base font-medium">
              {t("experimentDataTable.table")} {tableName}
            </h5>
            <BulkActionsBar
              experimentId={experimentId}
              tableName={tableName}
              rowIds={selectedRowIds}
              totalComments={totalSelectedComments}
              totalFlags={totalSelectedFlags}
              clearSelection={() => selectionForm.setValue("selectedRowId", [])}
              downloadTable={() => setDownloadModalOpen(true)}
            />
          </>
        )}
        <div className="text-muted-foreground relative overflow-visible rounded-md border">
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
      </form>
    </Form>
  );
}
