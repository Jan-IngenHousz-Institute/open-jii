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
}: {
  experimentId: string;
  tableName: string;
  pageSize: number;
}) {
  const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize });
  const { data, isLoading } = useExperimentData(experimentId, {
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    tableName,
  });

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

  if (isLoading) return <div>Data loading... Please wait. It can take several minutes.</div>;
  if (!data?.body) return <div>No data returned for table {tableName}</div>;
  const tableData: ExperimentDataTableInfo = data.body[0];
  if (!tableData.data) return <div>No table data returned for table {tableName}</div>;

  return (
    <div className="container mx-auto py-10">
      <div className="mb-2 text-center">Table: {tableData.name}</div>
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
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <div>
          Page {pagination.pageIndex + 1} of {table.getPageCount()}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>
      <div className="text-xs">
        Total rows {tableData.totalRows} | Page {tableData.page} | Total pages{" "}
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
  const { data, isLoading } = useExperimentData(experimentId, {
    page: 1,
    pageSize: sampleSize,
  });

  const { t } = useTranslation(undefined, "common");
  if (isLoading) return <div>Data loading... Please wait. It can take several minutes.</div>;
  if (data?.body) {
    return (
      <>
        {data.body.map((table) => (
          <div key={table.name}>
            <InternalSampleExperimentDataTable tableData={table} />
            <div className="ml-4">
              <Link href={`/platform/data-test/${experimentId}/${table.name}`} locale={locale}>
                <Button>{t("experimentTable.details")}</Button>
              </Link>
            </div>
          </div>
        ))}
      </>
    );
  }
  return <div>No data returned</div>;
}

function InternalSampleExperimentDataTable({ tableData }: { tableData: ExperimentDataTableInfo }) {
  if (!tableData.data) return <div>No table data returned for table {tableData.name}</div>;
  const columns = getReactTableColumns(tableData.data);
  const newData = getReactTableData(tableData.data);
  return (
    <div className="container mx-auto py-10">
      <div className="mb-2 text-center">Table: {tableData.name}</div>
      <SampleDataTable columns={columns} data={newData} />
    </div>
  );
}

interface SampleDataTableProps {
  columns: ColumnDef<DataRow, DataValue>[];
  data: DataRow[];
}

function SampleDataTable({ columns, data }: SampleDataTableProps) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

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
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
