"use client";

import type {
  DataRow,
  TableMetadata,
} from "@/hooks/experiment/useExperimentData/useExperimentData";
import { useExperimentData } from "@/hooks/experiment/useExperimentData/useExperimentData";
import type { PaginationState, Updater } from "@tanstack/react-table";
import { getCoreRowModel, getPaginationRowModel, useReactTable } from "@tanstack/react-table";
import { Download } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import {
  ExperimentDataRows,
  ExperimentTableHeader,
  formatValue,
  LoadingRows,
} from "~/components/experiment-data/experiment-data-utils";

import { useTranslation } from "@repo/i18n";
import {
  Button,
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
  const { t } = useTranslation();

  // Use traditional pagination with improved column persistence
  const { tableMetadata, tableRows, isLoading, error } = useExperimentData(
    experimentId,
    pagination.pageIndex + 1,
    pagination.pageSize,
    tableName,
    formatValue,
  );

  const onPaginationChange = useCallback(
    (updaterOrValue: Updater<PaginationState>) => {
      if (typeof updaterOrValue === "function") {
        const newPagination = updaterOrValue(pagination);
        setPagination(newPagination);
      } else {
        setPagination(updaterOrValue);
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

  return (
    <div>
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
    </div>
  );
}
