"use client";

import { IntentLink } from "@/components/navigation/intent-link/intent-link";
import type { OverviewTableColumn } from "@/components/overview-table/overview-table";
import { overviewTableText } from "@/components/overview-table/overview-table";

import type { Dataset } from "@repo/api/domains/dataset/dataset.schema";
import { cn } from "@repo/ui/lib/utils";

import { DatasetDoiLink } from "../dataset-doi-link";
import { DatasetStateBadge } from "../dataset-state-badge";
import { LICENSE_KEYS } from "../license-keys";

interface DatasetCatalogueColumnsOptions {
  t: (key: string, options?: Record<string, unknown>) => string;
  formatDate: (value: string) => string;
}

function authorNames(dataset: Dataset): string {
  return dataset.authors.map((author) => `${author.givenName} ${author.familyName}`).join(", ");
}

export function getDatasetCatalogueColumns({
  t,
  formatDate,
}: DatasetCatalogueColumnsOptions): OverviewTableColumn<Dataset>[] {
  return [
    {
      header: t("catalogue.columns.title"),
      cell: (dataset, href) => (
        <>
          <div className="flex min-w-0 items-center gap-2">
            <IntentLink
              href={href}
              title={dataset.title}
              onClick={(event) => event.stopPropagation()}
              className={cn(
                "min-w-0 truncate text-[13px] font-semibold hover:underline",
                overviewTableText.strong,
              )}
            >
              {dataset.title}
            </IntentLink>
            {/* Only drafts are marked: a catalogue row is published unless it says otherwise. */}
            {dataset.state === "draft" ? <DatasetStateBadge state={dataset.state} /> : null}
          </div>
          <p className={cn("mt-1 truncate text-xs", overviewTableText.muted)}>
            {authorNames(dataset)}
          </p>
        </>
      ),
    },
    {
      header: t("catalogue.columns.license"),
      className: "w-32",
      cell: (dataset) => (
        <span className={cn("text-[13px]", overviewTableText.strong)}>
          {dataset.license === null ? "" : t(`licenses.${LICENSE_KEYS[dataset.license]}`)}
        </span>
      ),
    },
    {
      header: t("catalogue.columns.date"),
      className: "hidden w-36 md:table-cell",
      cell: (dataset) => (
        <span className={cn("text-[13px] tabular-nums", overviewTableText.muted)}>
          {formatDate(dataset.publishedAt ?? dataset.createdAt)}
        </span>
      ),
    },
    {
      header: t("catalogue.columns.doi"),
      className: "hidden w-64 lg:table-cell",
      cell: (dataset) =>
        dataset.doi === null ? (
          <span className={cn("text-[13px]", overviewTableText.muted)}>{t("list.noDoi")}</span>
        ) : (
          <DatasetDoiLink doi={dataset.doi} className="text-[13px]" />
        ),
    },
  ];
}
