"use client";

import { IntentLink } from "@/components/navigation/intent-link/intent-link";
import { useLocale } from "@/hooks/useLocale";
import { FlaskConical, Layers } from "lucide-react";

import type { PublicDataset } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";

import { DatasetNotice } from "./dataset-notice";

/** A newer version or a test deposit, said before the citation so nobody cites the wrong thing. */
export function DatasetStateNotices({ dataset }: { dataset: PublicDataset }) {
  const { t } = useTranslation("datasets");
  const locale = useLocale();

  const isTestDeposit = dataset.depositEnvironment === "sandbox";
  const newer =
    dataset.state === "superseded" &&
    dataset.supersededById !== null &&
    dataset.supersededByVersion !== null
      ? { id: dataset.supersededById, version: dataset.supersededByVersion }
      : null;

  return (
    <>
      {isTestDeposit ? (
        <DatasetNotice
          icon={FlaskConical}
          title={t("page.testTitle")}
          tone="caution"
          testId="dataset-test-deposit"
        >
          <p>{t("page.testDetail")}</p>
        </DatasetNotice>
      ) : null}

      {newer !== null ? (
        <DatasetNotice
          icon={Layers}
          title={t("page.supersededTitle")}
          tone="neutral"
          testId="dataset-superseded"
        >
          <p>{t("page.supersededDetail", { version: newer.version })}</p>
          <IntentLink
            href={`/${locale}/datasets/${newer.id}`}
            className="text-primary font-medium hover:underline"
          >
            {t("page.supersededLink", { version: newer.version })}
          </IntentLink>
        </DatasetNotice>
      ) : null}
    </>
  );
}
