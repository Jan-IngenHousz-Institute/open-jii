"use client";

import { SettingsCard } from "@/components/shared/settings-card";
import { useLocalDateFormat } from "@/hooks/useLocalDateFormat";
import { useLocale } from "@/hooks/useLocale";
import type { ReactNode } from "react";

import type { DatasetAuthor, DatasetScope } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";

import { LICENSE_KEYS } from "../license-keys";
import type { PublishDatasetForm } from "./dataset-publish-schema";

interface SummaryRow {
  label: string;
  value: ReactNode;
}

interface FreezeSummaryCardProps {
  values: PublishDatasetForm;
  scope: DatasetScope;
}

/** What the dataset page will show, read back from the draft before anything is written. */
export function FreezeSummaryCard({ values, scope }: FreezeSummaryCardProps) {
  const { t } = useTranslation("datasets");
  const locale = useLocale();
  const format = useLocalDateFormat(locale);

  const embargoUntil = values.access === "embargoed" ? values.embargoUntil : undefined;
  const access =
    embargoUntil !== undefined
      ? t("freeze.accessEmbargoed", { date: format.date(embargoUntil) })
      : t("freeze.accessOpen");
  const excludedCount = values.excludedReadings.length;

  const renderAuthor = (author: DatasetAuthor, position: number) => (
    <li key={`${author.givenName}-${author.familyName}`} className="tabular-nums">
      {position + 1}. {author.givenName} {author.familyName}
    </li>
  );

  const rows: SummaryRow[] = [
    { label: t("freeze.titleLabel"), value: values.title },
    {
      label: t("freeze.authorsLabel"),
      value: <ol className="space-y-0.5">{values.authors.map(renderAuthor)}</ol>,
    },
    { label: t("freeze.licenseLabel"), value: t(`licenses.${LICENSE_KEYS[values.license]}`) },
    { label: t("freeze.accessLabel"), value: access },
    {
      label: t("freeze.readingsLabel"),
      value: (
        <>
          <p>
            {t("freeze.readings", {
              count: scope.readingCount,
              time: format.dateTime(scope.countedAt),
            })}
          </p>
          {excludedCount > 0 ? (
            <p className="text-muted-foreground">
              {t("freeze.excluded", { count: excludedCount })}
            </p>
          ) : null}
        </>
      ),
    },
    { label: t("freeze.filesLabel"), value: t("freeze.files") },
  ];

  const renderRow = ({ label, value }: SummaryRow) => (
    <div key={label} className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[12rem_1fr]">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );

  return (
    <SettingsCard
      title={t("freeze.title")}
      description={t("freeze.description")}
      data-testid="freeze-summary"
    >
      <dl className="divide-border divide-y">{rows.map(renderRow)}</dl>
    </SettingsCard>
  );
}
