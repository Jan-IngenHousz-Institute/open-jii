"use client";

import { useLocalDateFormat } from "@/hooks/useLocalDateFormat";
import { useLocale } from "@/hooks/useLocale";
import { Ban } from "lucide-react";

import { useTranslation } from "@repo/i18n";

interface DatasetWithdrawalNoticeProps {
  withdrawnAt: string;
  reason: string;
}

/** Takes the files' place on a tombstone, so the DOI still resolves to a page that says why. */
export function DatasetWithdrawalNotice({ withdrawnAt, reason }: DatasetWithdrawalNoticeProps) {
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
      </div>
    </section>
  );
}
