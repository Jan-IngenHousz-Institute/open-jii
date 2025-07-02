"use client";

import { useExperimentData } from "@/hooks/experiment/useExperimentData/useExperimentData";
import type {
  AccessorKeyColumnDef,
  PaginationState,
  Row,
  RowData,
  Updater,
} from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type z from "zod";

import type { ExperimentData, zExperimentDataTableInfo } from "@repo/api";
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

const staleTime = 2 * 60 * 1000;

export type DataValue = string | number | boolean | null;
export type DataRow = Record<string, DataValue>;

function getFormattedValue(row: Row<DataRow>, columnName: string, type_name: string) {
  const value = row.getValue(columnName);
  switch (type_name) {
    case "DOUBLE":
    case "INT":
    case "LONG":
    case "BIGINT":
      return (
        <div className="text-right font-medium">
          <i>{value as number}</i>
        </div>
      );
    case "TIMESTAMP":
      return (value as string).substring(0, 19).replace("T", " ");
    default: {
      return value as string;
    }
  }
}

export function getReactTableColumns(
  data: ExperimentData | undefined,
  persistedColumns?: AccessorKeyColumnDef<DataRow, DataValue>[],
) {
  const columnHelper = createColumnHelper<DataRow>();

  // Return persisted columns if data is loading and we have them
  if (!data && persistedColumns) {
    return persistedColumns;
  }

  const columns: AccessorKeyColumnDef<DataRow, DataValue>[] = [];
  if (!data) return columns;

  data.columns.forEach((dataColumn) => {
    columns.push(
      columnHelper.accessor(dataColumn.name, {
        header: dataColumn.name,
        cell: ({ row }) => {
          return getFormattedValue(row, dataColumn.name, dataColumn.type_name);
        },
      }),
    );
  });
  return columns;
}

export function getReactTableData(data: ExperimentData | undefined) {
  const newData: DataRow[] = [];
  if (!data) return newData;
  data.rows.forEach((row) => {
    const dataRow: DataRow = {};
    row.forEach((dataColumn, index) => {
      dataRow[data.columns[index].name] = dataColumn;
    });
    newData.push(dataRow);
  });
  return newData;
}

export type ExperimentDataTableInfo = z.infer<typeof zExperimentDataTableInfo>;

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
  const [persistedColumns, setPersistedColumns] =
    useState<AccessorKeyColumnDef<DataRow, DataValue>[]>();
  const [totalPages, setTotalPages] = useState<number>();
  const [totalRows, setTotalRows] = useState<number>(0);

  // Use traditional pagination with improved column persistence
  const { data, isLoading, error } = useExperimentData(
    experimentId,
    {
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      tableName,
    },
    staleTime,
  );

  const { t } = useTranslation(locale, "common");

  const onPaginationChange = useCallback(
    (updaterOrValue: Updater<PaginationState>) => {
      if (typeof updaterOrValue === "function") {
        const newPagination = updaterOrValue(pagination);
        setPagination(newPagination);
      }
    },
    [pagination],
  );

  // Update persisted columns when we get new data
  useEffect(() => {
    const tableData = data?.body[0];
    if (tableData?.data) {
      const newColumns = getReactTableColumns(tableData.data);
      if (newColumns.length > 0) {
        setPersistedColumns(newColumns);
        setTotalPages(tableData.totalPages);
        setTotalRows(tableData.totalRows);
      }
    }
  }, [data?.body]);

  // Use either current columns or persisted columns
  const currentColumns = useMemo(() => {
    const tableData = data?.body[0];
    if (tableData?.data) {
      return getReactTableColumns(tableData.data);
    }
    return persistedColumns ?? [];
  }, [data?.body, persistedColumns]);

  const rows: DataRow[] = useMemo(() => {
    const tableData = data?.body[0];
    return getReactTableData(tableData?.data);
  }, [data?.body]);

  const tableData = data?.body[0];

  const table = useReactTable({
    data: rows,
    columns: currentColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    onPaginationChange,
    state: {
      pagination,
    },
    rowCount: tableData?.totalRows ?? 0,
    defaultColumn: {
      size: 180,
    },
  });

  if (isLoading && !persistedColumns) {
    return <div>{t("experimentDataTable.loading")}</div>;
  }

  if (error) {
    return <div>{t("experimentDataTable.error")}</div>;
  }

  if (!data?.body && !isLoading) {
    return <div>{t("experimentDataTable.noData")}</div>;
  }

  if (!tableData?.data && !isLoading && !persistedColumns) {
    return <div>{t("experimentDataTable.noData")}</div>;
  }

  // Calculate column count for empty state
  const columnCount = currentColumns.length || (tableData?.data?.columns.length ?? 1);
  const loadingRowCount =
    pagination.pageIndex + 1 == totalPages ? totalRows % pagination.pageSize : pagination.pageSize;

  return (
    <div className="container mx-auto py-10">
      <div className="mb-2 text-center">
        {t("experimentDataTable.table")}: {tableData?.name ?? tableName}
      </div>
      <div className="rounded-md border">
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
            {isLoading && persistedColumns && (
              <LoadingRows
                columnCount={persistedColumns.length}
                rowCount={loadingRowCount}
                locale={locale}
              />
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
        <div>
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
