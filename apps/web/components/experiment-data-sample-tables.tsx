"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import Link from "next/link";
import type {
  DataRow,
  DataValue,
  ExperimentDataTableInfo,
} from "~/components/experiment-data-table";
import { getReactTableColumns, getReactTableData } from "~/components/experiment-data-table";
import { useExperimentData } from "~/hooks/experiment/useExperimentData/useExperimentData";

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

const staleTime = 2 * 60 * 1000;

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
      <div className="mb-4 text-center">{tableData.name}</div>
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
    defaultColumn: {
      size: 180,
    },
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
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
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
