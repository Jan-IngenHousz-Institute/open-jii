"use client";

import { useLocalDateFormat } from "@/hooks/useLocalDateFormat";
import { useLocale } from "@/hooks/useLocale";
import type { ReactNode } from "react";

import type { PublicDataset } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";

import { DatasetDoiLink } from "../dataset-doi-link";
import { LICENSE_KEYS } from "../license-keys";

interface Fact {
  label: string;
  value: ReactNode;
}

export function DatasetFacts({ dataset }: { dataset: PublicDataset }) {
  const { t } = useTranslation("datasets");
  const locale = useLocale();
  const format = useLocalDateFormat(locale);

  const facts: Fact[] = [
    { label: t("list.columns.version"), value: dataset.version },
    ...(dataset.publishedAt !== null
      ? [{ label: t("page.published"), value: format.date(dataset.publishedAt) }]
      : []),
    ...(dataset.license !== null
      ? [{ label: t("page.license"), value: t(`licenses.${LICENSE_KEYS[dataset.license]}`) }]
      : []),
    ...(dataset.doi !== null
      ? [{ label: t("page.doi"), value: <DatasetDoiLink doi={dataset.doi} /> }]
      : []),
  ];

  const renderFact = ({ label, value }: Fact) => (
    <div key={label} className="space-y-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );

  return <dl className="flex flex-wrap gap-x-10 gap-y-3">{facts.map(renderFact)}</dl>;
}
