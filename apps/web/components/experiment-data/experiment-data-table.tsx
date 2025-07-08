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
import { Button, Table, TableBody } from "@repo/ui/components";

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
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="mr-2 text-sm">
          {t("experimentDataTable.page")} {pagination.pageIndex + 1}{" "}
          {t("experimentDataTable.pageOf")} {totalPages}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          {t("experimentDataTable.previous")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          {t("experimentDataTable.next")}
        </Button>
      </div>
    </div>
  );
}
