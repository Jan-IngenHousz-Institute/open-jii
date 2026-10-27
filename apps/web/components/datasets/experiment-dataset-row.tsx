"use client";

import { IntentLink } from "@/components/navigation/intent-link/intent-link";
import { useLocalDateFormat } from "@/hooks/useLocalDateFormat";
import { useLocale } from "@/hooks/useLocale";

import type { Dataset } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";
import { TableCell, TableRow } from "@repo/ui/components/table";

import { DatasetDepositStatus } from "./dataset-deposit-status";
import { DatasetDoiLink } from "./dataset-doi-link";
import { DatasetRowActions } from "./dataset-row-actions";
import { DatasetStateBadge } from "./dataset-state-badge";
import { DatasetVersionCell } from "./dataset-version-cell";

interface ExperimentDatasetRowProps {
  dataset: Dataset;
  /** The version this one supersedes, when it is the next row down. */
  supersededVersion: number | null;
  isSupersededAbove: boolean;
  /** Set once any dataset has been deposited, so the column means something. */
  showsDoi: boolean;
  showsViews: boolean;
  /** People who can edit the experiment retry a deposit. */
  canPublish: boolean;
  /** Only admins withdraw or open embargoed files early. */
  canManage: boolean;
}

export function ExperimentDatasetRow({
  dataset,
  supersededVersion,
  isSupersededAbove,
  showsDoi,
  showsViews,
  canPublish,
  canManage,
}: ExperimentDatasetRowProps) {
  const { t } = useTranslation("datasets");
  const locale = useLocale();
  const format = useLocalDateFormat(locale);

  const isDraft = dataset.state === "draft";
  const embargoUntil = dataset.access === "embargoed" ? dataset.embargoUntil : null;
  const zenodoCopy = dataset.state === "withdrawn" ? dataset.zenodoCopy : null;
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

  const readingsLabel =
    dataset.readingCount === null
      ? t("list.notFrozen")
      : t("list.readings", { count: dataset.readingCount });

  const doiCell = () => {
    if (dataset.deposit !== null && dataset.deposit.status !== "deposited") {
      return <DatasetDepositStatus deposit={dataset.deposit} canRetry={canPublish} />;
    }
    if (dataset.doi === null) {
      return (
        <span className="text-muted-foreground">
          {isDraft ? t("list.doiAtFreeze") : t("list.notDeposited")}
        </span>
      );
    }
    return (
      <div className="space-y-1.5">
        <DatasetDoiLink doi={dataset.doi} />
        {dataset.deposit !== null ? (
          <DatasetDepositStatus deposit={dataset.deposit} canRetry={canPublish} />
        ) : null}
        {zenodoCopy !== null ? (
          <p className="text-muted-foreground text-xs">{t(`zenodoCopy.${zenodoCopy}`)}</p>
        ) : null}
      </div>
    );
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

      <TableCell className="text-muted-foreground py-3">
        <p>{dateLabel()}</p>
        {embargoUntil !== null ? (
          <p className="text-xs">{t("list.filesOpen", { date: format.date(embargoUntil) })}</p>
        ) : null}
      </TableCell>

      <TableCell className="text-muted-foreground tabular-nums">{readingsLabel}</TableCell>

      {showsViews ? (
        <TableCell className="text-muted-foreground tabular-nums">
          {dataset.viewCount === null
            ? t("list.noPage")
            : t("list.views", { count: dataset.viewCount })}
        </TableCell>
      ) : null}

      {showsDoi ? <TableCell className="py-3">{doiCell()}</TableCell> : null}

      {canManage ? (
        <TableCell className="w-12 pr-3 text-right">
          <DatasetRowActions dataset={dataset} />
        </TableCell>
      ) : null}
    </TableRow>
  );
}
