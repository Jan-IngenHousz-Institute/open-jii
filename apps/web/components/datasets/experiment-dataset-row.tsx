"use client";

import { IntentLink } from "@/components/navigation/intent-link/intent-link";
import { useLocalDateFormat } from "@/hooks/useLocalDateFormat";
import { useLocale } from "@/hooks/useLocale";

import type { Dataset } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";
import { TableCell, TableRow } from "@repo/ui/components/table";

import { DatasetDepositStatus } from "./dataset-deposit-status";
import { DatasetDoiLink } from "./dataset-doi-link";
import { DatasetStateBadge } from "./dataset-state-badge";
import { DatasetVersionCell } from "./dataset-version-cell";

interface ExperimentDatasetRowProps {
  dataset: Dataset;
  /** The version this one supersedes, when it is the next row down. */
  supersededVersion: number | null;
  isSupersededAbove: boolean;
}

export function ExperimentDatasetRow({
  dataset,
  supersededVersion,
  isSupersededAbove,
}: ExperimentDatasetRowProps) {
  const { t } = useTranslation("datasets");
  const locale = useLocale();
  const format = useLocalDateFormat(locale);

  const isDraft = dataset.state === "draft";
  // A Draft reopens the publish flow; everything else has a dataset page.
  const href = isDraft
    ? `/${locale}/platform/experiments/${dataset.experimentId}/datasets/${dataset.id}/publish`
    : `/${locale}/datasets/${dataset.id}`;

  const dateLabel = () => {
    if (dataset.withdrawnAt !== null) {
      return t("list.withdrawn", { date: format.date(dataset.withdrawnAt) });
    }
    if (dataset.publishedAt !== null) {
      return t("list.published", { date: format.date(dataset.publishedAt) });
    }
    return t("list.started", { date: format.date(dataset.createdAt) });
  };

  return (
    <TableRow>
      <DatasetVersionCell
        version={dataset.version}
        isSupersededAbove={isSupersededAbove}
        supersedesBelow={supersededVersion !== null}
      />

      <TableCell className="py-3">
        <IntentLink href={href} className="font-medium hover:underline">
          {dataset.title}
        </IntentLink>
        {supersededVersion !== null ? (
          <p className="text-muted-foreground mt-0.5 text-xs">
            {t("list.supersedes", { version: supersededVersion })}
          </p>
        ) : null}
      </TableCell>

      <TableCell>
        <DatasetStateBadge state={dataset.state} />
      </TableCell>

      <TableCell className="text-muted-foreground">{dateLabel()}</TableCell>

      <TableCell className="py-3">
        <div className="space-y-1.5">
          {dataset.doi !== null ? (
            <DatasetDoiLink doi={dataset.doi} />
          ) : (
            <span className="text-muted-foreground">{t("list.noDoi")}</span>
          )}
          {dataset.deposit !== null ? <DatasetDepositStatus deposit={dataset.deposit} /> : null}
        </div>
      </TableCell>
    </TableRow>
  );
}
