"use client";

import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { TableIcon } from "lucide-react";
import Link from "next/link";
import React from "react";
import { formatValue } from "~/components/experiment-data/experiment-data-utils";
import {
  ExperimentDataRows,
  ExperimentTableHeader,
} from "~/components/experiment-data/experiment-data-utils";
import type { DataRow, SampleTable } from "~/hooks/experiment/useExperimentData/useExperimentData";
import { useExperimentSampleData } from "~/hooks/experiment/useExperimentData/useExperimentData";

import type { Locale } from "@repo/i18n";
import { useTranslation } from "@repo/i18n";
import { Button, Table, TableBody } from "@repo/ui/components";

export function ExperimentDataSampleTables({
  experimentId,
  sampleSize = 10,
  locale,
}: {
  experimentId: string;
  sampleSize: number;
  locale: Locale;
}) {
  const { sampleTables, isLoading } = useExperimentSampleData({
    experimentId,
    sampleSize,
    formatFunction: formatValue,
  });

  const { t } = useTranslation();
  if (isLoading) return <div>{t("experimentDataTable.loading")}</div>;
  if (sampleTables.length == 0) return <div>{t("experimentDataTable.noData")}</div>;
  return (
    <>
      {sampleTables.map((sampleTable) => (
        <div key={sampleTable.name}>
          <ExperimentDataSampleTable sampleTable={sampleTable} />
          <div className="text-muted-foreground mt-4">
            <Link href={`/${locale}/platform/experiments/${experimentId}/data/${sampleTable.name}`}>
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

function ExperimentDataSampleTable({ sampleTable }: { sampleTable: SampleTable }) {
  const { t } = useTranslation();
  const columns = sampleTable.tableMetadata.columns;
  const table = useReactTable<DataRow>({
    data: sampleTable.tableRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    defaultColumn: {
      size: 180,
    },
  });

  return (
    <>
      <h5 className="mb-4 text-base font-medium">
        {t("experimentDataTable.table")} {sampleTable.name}
      </h5>
      <div className="text-muted-foreground rounded-md border">
        <Table>
          <ExperimentTableHeader headerGroups={table.getHeaderGroups()} />
          <TableBody>
            <ExperimentDataRows rows={table.getRowModel().rows} columnCount={columns.length} />
          </TableBody>
        </Table>
      </div>
    </>
  );
}
