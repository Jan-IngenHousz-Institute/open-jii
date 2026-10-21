"use client";

import { useLocalDateFormat } from "@/hooks/useLocalDateFormat";
import { useLocale } from "@/hooks/useLocale";
import { BookOpenText } from "lucide-react";
import type { ReactNode } from "react";

import type { PublicDataset } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";

interface AboutRow {
  label: string;
  value: ReactNode;
}

/** The frozen study details and counts, so a reader judges fit before downloading anything. */
export function DatasetAbout({ dataset }: { dataset: PublicDataset }) {
  const { t } = useTranslation("datasets");
  const locale = useLocale();
  const format = useLocalDateFormat(locale);
  const details = dataset.studyDetails;
  const hasDictionary = dataset.files.some((file) => file.kind === "dataDictionary");

  const period =
    details?.startDate && details.endDate
      ? t("page.aboutFields.periodValue", {
          start: format.date(details.startDate),
          end: format.date(details.endDate),
        })
      : null;

  const hasExclusions = dataset.excludedCount > 0;
  const readingsWithExclusions = (readingCount: number) =>
    hasExclusions
      ? t("page.aboutFields.readingsExcluded", {
          readings: readingCount,
          count: dataset.excludedCount,
        })
      : readingCount;
  const readings =
    dataset.readingCount === null ? null : readingsWithExclusions(dataset.readingCount);

  const candidates: { label: string; value: ReactNode | null | undefined }[] = [
    { label: t("page.aboutFields.organism"), value: details?.organism },
    { label: t("page.aboutFields.period"), value: period },
    { label: t("page.aboutFields.design"), value: details?.experimentalDesign },
    { label: t("page.aboutFields.facility"), value: details?.growthFacility },
    { label: t("page.aboutFields.plots"), value: dataset.plotCount },
    { label: t("page.aboutFields.readings"), value: readings },
    {
      label: t("page.aboutFields.dictionary"),
      value: hasDictionary ? (
        <a
          href="#dataset-files"
          className="text-primary inline-flex items-center gap-1 hover:underline"
        >
          <BookOpenText className="size-3.5" aria-hidden />
          {t("page.aboutFields.dictionaryValue")}
        </a>
      ) : null,
    },
  ];
  const rows = candidates.filter(
    (row): row is AboutRow => row.value !== null && row.value !== undefined,
  );

  const renderRow = ({ label, value }: AboutRow) => (
    <div key={label} className="space-y-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );

  return (
    <section className="space-y-2" data-testid="dataset-about">
      <h2 className="text-lg font-semibold">{t("page.about")}</h2>
      <dl className="bg-card grid gap-x-8 gap-y-4 rounded-lg border p-4 sm:grid-cols-3">
        {rows.map(renderRow)}
      </dl>
    </section>
  );
}
