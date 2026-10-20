"use client";

import type { Dataset } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@repo/ui/components/table";

import { ExperimentDatasetRow } from "./experiment-dataset-row";

/** Newest version first, so a dataset's predecessor in the chain is the row below it. */
export function ExperimentDatasetsTable({ datasets }: { datasets: Dataset[] }) {
  const { t } = useTranslation("datasets");

  const renderRow = (dataset: Dataset, index: number) => {
    const below = datasets.at(index + 1);
    const above = index > 0 ? datasets.at(index - 1) : undefined;
    const supersededVersion = below?.id === dataset.supersedesId ? below.version : null;

    return (
      <ExperimentDatasetRow
        key={dataset.id}
        dataset={dataset}
        supersededVersion={supersededVersion}
        isSupersededAbove={above?.supersedesId === dataset.id}
      />
    );
  };

  return (
    <div className="bg-card rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-36 pl-4">{t("list.columns.version")}</TableHead>
            <TableHead>{t("list.columns.title")}</TableHead>
            <TableHead className="w-32">{t("list.columns.state")}</TableHead>
            <TableHead className="w-52">{t("list.columns.date")}</TableHead>
            <TableHead className="w-72">{t("list.columns.doi")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>{datasets.map(renderRow)}</TableBody>
      </Table>
    </div>
  );
}
