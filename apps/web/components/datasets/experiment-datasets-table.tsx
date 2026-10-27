"use client";

import type { Dataset } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@repo/ui/components/table";

import { ExperimentDatasetRow } from "./experiment-dataset-row";

interface ExperimentDatasetsTableProps {
  datasets: Dataset[];
  canPublish: boolean;
  canManage: boolean;
}

/** Newest version first, so a dataset's predecessor in the chain is the row below it. */
export function ExperimentDatasetsTable({
  datasets,
  canPublish,
  canManage,
}: ExperimentDatasetsTableProps) {
  const { t } = useTranslation("datasets");
  const showsDoi = datasets.some((dataset) => dataset.doi !== null || dataset.deposit !== null);
  // View counts are for the people who publish, and only once a page has been counted.
  const showsViews = canPublish && datasets.some((dataset) => dataset.viewCount !== null);

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
        showsDoi={showsDoi}
        showsViews={showsViews}
        canPublish={canPublish}
        canManage={canManage}
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
            <TableHead className="w-48">{t("list.columns.date")}</TableHead>
            <TableHead className="w-36">{t("list.columns.readings")}</TableHead>
            {showsViews ? <TableHead className="w-28">{t("list.columns.views")}</TableHead> : null}
            {showsDoi ? <TableHead className="w-72">{t("list.columns.doi")}</TableHead> : null}
            {canManage ? (
              <TableHead className="w-12">
                <span className="sr-only">{t("list.columns.actions")}</span>
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>{datasets.map(renderRow)}</TableBody>
      </Table>
    </div>
  );
}
