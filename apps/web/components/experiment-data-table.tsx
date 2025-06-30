"use client";

import { useExperimentData } from "@/hooks/experiment/useExperimentData/useExperimentData";
import type {
  AccessorKeyColumnDef,
  ColumnDef,
  PaginationState,
  Row,
  Updater,
} from "@tanstack/react-table";
import { getPaginationRowModel } from "@tanstack/react-table";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import Link from "next/link";
import React from "react";
import type z from "zod";

import type { ExperimentData, zExperimentDataTableInfo } from "@repo/api";
import type { Locale } from "@repo/i18n";
import { useTranslation } from "@repo/i18n";
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components";

type DataValue = string | number | boolean | null;
type DataRow = Record<string, DataValue>;
type MetaType = "number" | "text";

const staleTime = 2 * 60 * 1000;

function getColumnMetaType(type_name: string) {
  switch (type_name) {
    case "DOUBLE":
    case "INT":
    case "LONG":
    case "BIGINT":
      return "number";
    case "BOOLEAN":
    case "TIMESTAMP":
    case "DATE":
    default:
      return "text";
  }
}

function getFormattedValue(row: Row<DataRow>, columnName: string, metaType: MetaType) {
  const value = row.getValue(columnName);
  switch (metaType) {
    case "number": {
      return (
        <div className="text-right font-medium">
          <i>{value as number}</i>
        </div>
      );
    }
    default: {
      return <div className="font-medium">{value as string}</div>;
    }
  }
}

function getReactTableColumns(data: ExperimentData | undefined) {
  const columnHelper = createColumnHelper<DataRow>();
  const columns: AccessorKeyColumnDef<DataRow, DataValue>[] = [];
  if (!data) return columns;
  data.columns.forEach((dataColumn) => {
    const metaType = getColumnMetaType(dataColumn.type_name);
    columns.push(
      columnHelper.accessor(dataColumn.name, {
        header: dataColumn.name,
        meta: {
          type: metaType,
        },
        cell: ({ row }) => {
          return getFormattedValue(row, dataColumn.name, metaType);
        },
      }),
    );
  });
  return columns;
}

function getReactTableData(data: ExperimentData | undefined) {
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

type ExperimentDataTableInfo = z.infer<typeof zExperimentDataTableInfo>;

export function ExperimentDataTable({
  experimentId,
  tableName,
  pageSize = 15,
  locale,
}: {
  experimentId: string;
  tableName: string;
  pageSize: number;
  locale: Locale;
}) {
  const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize });
  const { data, isLoading } = useExperimentData(
    experimentId,
    {
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      tableName,
    },
    staleTime,
  );

  const { t } = useTranslation(locale, "common");
  const onPaginationChange = React.useCallback(
    (updaterOrValue: Updater<PaginationState>) => {
      if (typeof updaterOrValue === "function") {
        const newPagination = updaterOrValue(pagination);
        setPagination(newPagination);
      }
    },
    [pagination],
  );

  const columns: AccessorKeyColumnDef<DataRow, DataValue>[] = getReactTableColumns(
    data?.body[0].data,
  );
  const rows: DataRow[] = getReactTableData(data?.body[0].data);

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    onPaginationChange,
    state: {
      pagination,
    },
    rowCount: data?.body[0].totalRows ?? 0,
  });

  if (isLoading) return <div>{t("experimentDataTable.loading")}</div>;
  if (!data?.body) return <div>{t("experimentDataTable.noData")}</div>;
  const tableData: ExperimentDataTableInfo = data.body[0];
  if (!tableData.data) return <div>{t("experimentDataTable.noData")}</div>;

  return (
    <div className="container mx-auto py-10">
      <div className="mb-2 text-center">
        {t("experimentDataTable.table")}: {tableData.name}
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
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
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={tableData.data.columns.length} className="h-24 text-center">
                  {t("experimentDataTable.noResults")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <div>
          {t("experimentDataTable.page")} {pagination.pageIndex + 1}{" "}
          {t("experimentDataTable.pageOf")} {table.getPageCount()}
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
      <div className="text-xs">
        Debug info: Total rows {tableData.totalRows} | Page {tableData.page} | Total pages{" "}
        {tableData.totalPages} | {tableData.data.truncated ? "Truncated" : "Not truncated"}
      </div>
    </div>
  );
}

export function ExperimentDataSampleTables({
  experimentId,
  sampleSize = 10,
  locale,
}: {
  experimentId: string;
  sampleSize: number;
  locale: Locale;
}) {
  const { data, isLoading } = useExperimentData(
    experimentId,
    {
      page: 1,
      pageSize: sampleSize,
    },
    staleTime,
  );

  const { t } = useTranslation(locale, "common");
  if (isLoading) return <div>{t("experimentDataTable.loading")}</div>;
  if (data?.body) {
    return (
      <>
        {data.body.map((table) => (
          <div key={table.name}>
            <InternalSampleExperimentDataTable tableData={table} locale={locale} />
            <div className="ml-4">
              <Link href={`/platform/data-test/${experimentId}/${table.name}`} locale={locale}>
                <Button>{t("experimentDataTable.details")}</Button>
              </Link>
            </div>
          </div>
        ))}
      </>
    );
  }
  return <div>{t("experimentDataTable.noData")}</div>;
}

function InternalSampleExperimentDataTable({
  tableData,
  locale,
}: {
  tableData: ExperimentDataTableInfo;
  locale: Locale;
}) {
  const { t } = useTranslation(locale, "common");
  if (!tableData.data) return <div>{t("experimentDataTable.noData")}</div>;
  const columns = getReactTableColumns(tableData.data);
  const newData = getReactTableData(tableData.data);
  return (
    <div className="container mx-auto py-10">
      <div className="mb-2 text-center">
        {t("experimentDataTable.table")}: {tableData.name}
      </div>
      <SampleDataTable columns={columns} data={newData} locale={locale} />
    </div>
  );
}

interface SampleDataTableProps {
  columns: ColumnDef<DataRow, DataValue>[];
  data: DataRow[];
  locale: Locale;
}

function SampleDataTable({ columns, data, locale }: SampleDataTableProps) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const { t } = useTranslation(locale, "common");
  return (
    <div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
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
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  {t("experimentDataTable.noResults")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
