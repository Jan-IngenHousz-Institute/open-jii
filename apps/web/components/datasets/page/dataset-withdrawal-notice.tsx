"use client";

import { useLocalDateFormat } from "@/hooks/useLocalDateFormat";
import { useLocale } from "@/hooks/useLocale";
import { Ban } from "lucide-react";

import type { ZenodoCopyState } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";

interface DatasetWithdrawalNoticeProps {
  withdrawnAt: string;
  reason: string;
  doi: string | null;
  zenodoCopy: ZenodoCopyState | null;
}

/**
 * Takes the files' place on a tombstone. A Zenodo DOI resolves to Zenodo's record, whose copy
 * follows its own withdrawal, so the page says where the DOI leads and what state that copy is in.
 */
export function DatasetWithdrawalNotice({
  withdrawnAt,
  reason,
  doi,
  zenodoCopy,
}: DatasetWithdrawalNoticeProps) {
  const { t } = useTranslation("datasets");
  const locale = useLocale();
  const format = useLocalDateFormat(locale);

  return (
    <section
      className="border-destructive/40 bg-card flex items-start gap-3 rounded-lg border p-4"
      data-testid="dataset-withdrawal"
    >
      <Ban className="text-destructive mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">
          {t("page.withdrawnTitle", { date: format.date(withdrawnAt) })}
        </h2>
        <p className="text-sm">{t("page.withdrawnReason", { reason })}</p>
        <p className="text-muted-foreground text-sm">{t("page.withdrawnFiles")}</p>
        {doi !== null ? (
          <p className="text-muted-foreground text-sm">{t("page.withdrawnDoi", { doi })}</p>
        ) : null}
        {zenodoCopy !== null ? (
          <p className="text-muted-foreground text-sm">{t(`page.withdrawnZenodo.${zenodoCopy}`)}</p>
        ) : null}
      </div>
    </section>
  );
}
