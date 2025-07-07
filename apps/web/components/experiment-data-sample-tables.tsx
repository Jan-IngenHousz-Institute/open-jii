"use client";

import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { TableIcon } from "lucide-react";
import Link from "next/link";
import React from "react";
import { formatValue } from "~/components/experiment-data-table";
import type { SampleTable } from "~/hooks/experiment/useExperimentData/useExperimentData";
import { useExperimentSampleData } from "~/hooks/experiment/useExperimentData/useExperimentData";

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

export function ExperimentDataSampleTables({
  experimentId,
  sampleSize = 10,
  locale,
}: {
  experimentId: string;
  sampleSize: number;
  locale: Locale;
}) {
  const { sampleTables, isLoading } = useExperimentSampleData(
    experimentId,
    sampleSize,
    formatValue,
  );

  const { t } = useTranslation(locale, "common");
  if (isLoading) return <div>{t("experimentDataTable.loading")}</div>;
  if (sampleTables.length == 0) return <div>{t("experimentDataTable.noData")}</div>;
  return (
    <>
      {sampleTables.map((sampleTable) => (
        <div key={sampleTable.tableName}>
          <ExperimentDataSampleTable sampleTable={sampleTable} locale={locale} />
          <div className="text-muted-foreground mt-4">
            <Link
              href={`/${locale}/platform/experiments/${experimentId}/data/${sampleTable.tableName}`}
            >
              <Button variant="outline" size="sm">
                <TableIcon /> {t("experimentDataTable.details")}
              </Button>
            </Link>
          </div>
        </div>
      ))}
    </>
  );
}

function ExperimentDataSampleTable({
  sampleTable,
  locale,
}: {
  sampleTable: SampleTable;
  locale: Locale;
}) {
  const { t } = useTranslation(locale, "common");
  if (sampleTable.tableRows.length == 0) return <div>{t("experimentDataTable.noData")}</div>;
  return (
    <div className="">
      <h5 className="mb-4 text-base font-medium">
        {t("experimentDataTable.table")} {sampleTable.tableName}
      </h5>
      <SampleDataTable sampleTable={sampleTable} locale={locale} />
    </div>
  );
}

interface SampleDataTableProps {
  sampleTable: SampleTable;
  locale: Locale;
}

function SampleDataTable({ sampleTable, locale }: SampleDataTableProps) {
  const columns = sampleTable.tableMetadata.columns;
  const table = useReactTable({
    data: sampleTable.tableRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    defaultColumn: {
      size: 180,
    },
  });

  const { t } = useTranslation(locale, "common");
  return (
    <div>
      <div className="text-muted-foreground rounded-md border">
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
