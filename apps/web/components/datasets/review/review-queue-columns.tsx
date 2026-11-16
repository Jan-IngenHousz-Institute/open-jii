"use client";

import { IntentLink } from "@/components/navigation/intent-link/intent-link";
import type { OverviewTableColumn } from "@/components/overview-table/overview-table";
import { overviewTableText } from "@/components/overview-table/overview-table";

import type { ReviewQueueItem } from "@repo/api/domains/dataset/dataset.schema";
import { cn } from "@repo/ui/lib/utils";

interface ReviewQueueColumnsOptions {
  t: (key: string, options?: Record<string, unknown>) => string;
  formatDate: (value: string) => string;
  formatRelative: (value: string) => string;
}

/** The queue's columns, as the datasets catalogue lays out its own. */
export function getReviewQueueColumns({
  t,
  formatDate,
  formatRelative,
}: ReviewQueueColumnsOptions): OverviewTableColumn<ReviewQueueItem>[] {
  return [
    {
      header: t("review.columns.dataset"),
      cell: (item, href) => (
        <>
          <IntentLink
            href={href}
            title={item.title}
            onClick={(event) => event.stopPropagation()}
            className={cn(
              "block min-w-0 truncate text-[13px] font-semibold hover:underline",
              overviewTableText.strong,
            )}
          >
            {item.title}
          </IntentLink>
          <p className={cn("mt-1 truncate text-xs", overviewTableText.muted)}>
            {t("review.versionOf", { version: item.version, experiment: item.experimentName })}
          </p>
        </>
      ),
    },
    {
      header: t("review.columns.organization"),
      className: "hidden w-48 md:table-cell",
      cell: (item) => (
        <span className={cn("text-[13px]", overviewTableText.strong)}>
          {item.organizationName ?? t("review.personalWorkspace")}
        </span>
      ),
    },
    {
      header: t("review.columns.frozenBy"),
      className: "w-40",
      cell: (item) => (
        <span className={cn("text-[13px]", overviewTableText.strong)}>{item.frozenByName}</span>
      ),
    },
    {
      header: t("review.columns.waiting"),
      className: "w-44",
      cell: (item) => (
        <>
          <p className={cn("text-[13px]", overviewTableText.strong)}>
            {formatRelative(item.frozenAt)}
          </p>
          <p className={cn("text-xs", overviewTableText.muted)}>{formatDate(item.frozenAt)}</p>
        </>
      ),
    },
  ];
}
