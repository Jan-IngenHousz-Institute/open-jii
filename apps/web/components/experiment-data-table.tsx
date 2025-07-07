"use client";

import type { TableMetadata } from "@/hooks/experiment/useExperimentData/useExperimentData";
import { useExperimentData } from "@/hooks/experiment/useExperimentData/useExperimentData";
import type { PaginationState, Row, RowData, Updater } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import React, { useCallback, useEffect, useState } from "react";

import type { Locale } from "@repo/i18n";
import { useTranslation } from "@repo/i18n";
import {
  Button,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components";

export function formatValue(value: unknown, type: string) {
  switch (type) {
    case "DOUBLE":
    case "INT":
    case "LONG":
    case "BIGINT":
      return <div className="text-right italic">{value as number}</div>;
    case "TIMESTAMP":
      return (value as string).substring(0, 19).replace("T", " ");
    default: {
      return value as string;
    }
  }
}

export function ExperimentDataTable({
  experimentId,
  tableName,
  pageSize = 10,
  locale,
}: {
  experimentId: string;
  tableName: string;
  pageSize: number;
  locale: Locale;
}) {
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize });
  const [persistedMetaData, setPersistedMetaData] = useState<TableMetadata>();
  const { t } = useTranslation(locale, "common");

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

  const table = useReactTable({
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
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="h-2">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      style={{
                        minWidth: header.column.columnDef.size,
                      }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading && persistedMetaData && (
              <LoadingRows columnCount={columnCount} rowCount={loadingRowCount} locale={locale} />
            )}
            {!isLoading && table.getRowModel().rows.length && (
              <ExperimentDataRows rows={table.getRowModel().rows} />
            )}
            {!isLoading && table.getRowModel().rows.length == 0 && (
              <TableRow>
                <TableCell colSpan={columnCount} className="h-4 text-center">
                  {t("experimentDataTable.noResults")}
                </TableCell>
              </TableRow>
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

function ExperimentDataRows({ rows }: { rows: Row<RowData>[] }) {
  return rows.map((row) => (
    <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
      {row.getVisibleCells().map((cell) => (
        <TableCell
          key={cell.id}
          style={{
            minWidth: cell.column.columnDef.size,
          }}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  ));
}

function LoadingRows({
  rowCount,
  columnCount,
  locale,
}: {
  rowCount: number;
  columnCount: number;
  locale: Locale;
}) {
  const { t } = useTranslation(locale, "common");
  return (
    <>
      <TableRow>
        <TableCell colSpan={columnCount} className="h-4">
          {t("experimentDataTable.loading")}
        </TableCell>
      </TableRow>
      {Array.from({ length: rowCount - 1 }).map((_, index) => (
        <TableRow key={`skeleton-${index}`}>
          {Array.from({ length: columnCount }).map((_, colIndex) => (
            <TableCell key={colIndex}>
              <Skeleton className="h-4" key={`skeleton-col-${colIndex}`} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
