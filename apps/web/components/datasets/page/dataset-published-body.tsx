"use client";

import { useLocalDateFormat } from "@/hooks/useLocalDateFormat";
import { useLocale } from "@/hooks/useLocale";
import { CalendarClock, Info } from "lucide-react";

import type { PublicDataset } from "@repo/api/domains/dataset/dataset.schema";
import type { FundingReference } from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n";

import { DatasetAbout } from "./dataset-about";
import { DatasetFiles } from "./dataset-files";
import { DatasetNotice } from "./dataset-notice";
import { DatasetPublications } from "./dataset-publications";

/** Everything below the citation on a dataset that is not withdrawn. */
export function DatasetPublishedBody({ dataset }: { dataset: PublicDataset }) {
  const { t } = useTranslation("datasets");
  const locale = useLocale();
  const format = useLocalDateFormat(locale);

  const embargoUntil = dataset.access === "embargoed" ? dataset.embargoUntil : null;
  const hasLimitations = dataset.limitations !== null && dataset.limitations.trim() !== "";
  const hasFunding = dataset.funding.length > 0;
  const hasPublications = dataset.relatedPublications.length > 0;

  const renderFunding = (funding: FundingReference) => (
    <li key={funding.funderName}>
      {funding.awardNumber === null
        ? funding.funderName
        : t("page.fundingEntry", { funder: funding.funderName, award: funding.awardNumber })}
    </li>
  );

  return (
    <>
      <div className="bg-muted text-muted-foreground flex items-center gap-2 rounded-md p-3 text-sm">
        <Info className="text-primary size-4 shrink-0" aria-hidden />
        <span className="leading-tight">{t("page.frozenNotice")}</span>
      </div>

      {dataset.description !== null ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">{t("page.description")}</h2>
          <p className="text-sm leading-relaxed">{dataset.description}</p>
        </section>
      ) : null}

      {hasLimitations ? (
        <section className="space-y-2" data-testid="dataset-limitations">
          <h2 className="text-lg font-semibold">{t("page.limitations")}</h2>
          <p className="text-sm leading-relaxed">{dataset.limitations}</p>
        </section>
      ) : null}

      <DatasetAbout dataset={dataset} />

      {hasFunding ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">{t("page.funding")}</h2>
          <ul className="space-y-1 text-sm">{dataset.funding.map(renderFunding)}</ul>
        </section>
      ) : null}

      {hasPublications ? <DatasetPublications publications={dataset.relatedPublications} /> : null}

      {embargoUntil !== null ? (
        <DatasetNotice
          icon={CalendarClock}
          title={t("page.embargoTitle", { date: format.date(embargoUntil) })}
          tone="neutral"
          testId="dataset-embargo"
        >
          <p>{t("page.embargoDetail")}</p>
        </DatasetNotice>
      ) : (
        <DatasetFiles files={dataset.files} />
      )}
    </>
  );
}
