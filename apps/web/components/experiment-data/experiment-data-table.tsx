"use client";

import type {
  DataRow,
  TableMetadata,
} from "@/hooks/experiment/useExperimentData/useExperimentData";
import { useExperimentData } from "@/hooks/experiment/useExperimentData/useExperimentData";
import type { PaginationState, Updater } from "@tanstack/react-table";
import { getCoreRowModel, getPaginationRowModel, useReactTable } from "@tanstack/react-table";
import React, { useCallback, useEffect, useState } from "react";
import {
  ExperimentDataRows,
  ExperimentTableHeader,
  formatValue,
  LoadingRows,
} from "~/components/experiment-data/experiment-data-utils";

import { useTranslation } from "@repo/i18n";
import {
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
  const { t } = useTranslation(undefined, "common");

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
      <h5 className="mb-4 text-base font-medium">
        {t("experimentDataTable.table")} {tableName}
      </h5>
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
      <div className="mt-4 flex w-full flex-col-reverse items-center justify-between gap-4 overflow-auto p-1 text-sm sm:flex-row sm:gap-8">
        <div className="flex-1 whitespace-nowrap">Total rows: {totalRows}</div>
        <div className="flex items-center space-x-2">
          <Label className="whitespace-nowrap">Rows per page:</Label>
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
        <Pagination className="flex max-w-xs items-center justify-end pl-4">
          <PaginationContent className="w-full justify-between">
            <PaginationItem>
              <PaginationPrevious
                className={
                  table.getCanPreviousPage()
                    ? "border"
                    : "pointer-events-none cursor-not-allowed border opacity-50"
                }
                onClick={() => table.previousPage()}
                aria-disabled={!table.getCanPreviousPage()}
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
                className={
                  table.getCanNextPage()
                    ? "border"
                    : "pointer-events-none cursor-not-allowed border opacity-50"
                }
                onClick={() => table.nextPage()}
                aria-disabled={!table.getCanNextPage()}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
