"use client";

import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Download, TableIcon } from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";
import { DataDownloadModal } from "~/components/experiment-data/data-download-modal/data-download-modal";
import { formatValue } from "~/components/experiment-data/experiment-data-utils";
import {
  ExperimentDataRows,
  ExperimentTableHeader,
} from "~/components/experiment-data/experiment-data-utils";
import type { DataRow, SampleTable } from "~/hooks/experiment/useExperimentData/useExperimentData";
import { useExperimentSampleData } from "~/hooks/experiment/useExperimentData/useExperimentData";

import { useTranslation } from "@repo/i18n";
import { Button, Table, TableBody } from "@repo/ui/components";

export function ExperimentDataSampleTables({
  experimentId,
  sampleSize = 10,
  locale,
  archived = false,
}: {
  experimentId: string;
  sampleSize: number;
  locale: string;
  archived?: boolean;
}) {
  const { sampleTables, isLoading } = useExperimentSampleData(
    experimentId,
    sampleSize,
    formatValue,
  );

  const { t } = useTranslation();
  if (isLoading) return <div>{t("experimentDataTable.loading")}</div>;
  if (sampleTables.length == 0) return <div>{t("experimentDataTable.noData")}</div>;
  return (
    <>
      {sampleTables.map((sampleTable) => (
        <div key={sampleTable.name}>
          <ExperimentDataSampleTable sampleTable={sampleTable} />
          <div className="text-muted-foreground mt-4 flex gap-2">
            <Link
              href={`/${locale}/platform/experiments${archived ? "-archive" : ""}/${experimentId}/data/${sampleTable.name}`}
            >
              <Button variant="outline" size="sm">
                <TableIcon /> {t("experimentDataTable.details")}
              </Button>
            </Link>
            <DownloadButton experimentId={experimentId} tableName={sampleTable.name} />
          </div>
        </div>
      ))}
    </>
  );
}

function DownloadButton({ experimentId, tableName }: { experimentId: string; tableName: string }) {
  const { t } = useTranslation();
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setDownloadModalOpen(true)}
        className="flex items-center gap-2"
      >
        <Download className="h-4 w-4" />
        {t("experimentDataTable.download")}
      </Button>
      <DataDownloadModal
        experimentId={experimentId}
        tableName={tableName}
        open={downloadModalOpen}
        onOpenChange={setDownloadModalOpen}
      />
    </>
  );
}

function ExperimentDataSampleTable({ sampleTable }: { sampleTable: SampleTable }) {
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
      <h5 className="mb-4 text-base font-medium">{sampleTable.displayName}</h5>
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
