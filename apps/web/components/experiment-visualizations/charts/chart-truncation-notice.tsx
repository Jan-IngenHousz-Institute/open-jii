"use client";

import { formatLocaleNumber } from "@/util/format-locale-number";
import { useLocale } from "~/hooks/useLocale";

import { useTranslation } from "@repo/i18n";

import type { ChartTruncation } from "./hooks/use-chart-data";

interface ChartTruncationNoticeProps {
  truncation: ChartTruncation;
}

export function ChartTruncationNotice({ truncation }: ChartTruncationNoticeProps) {
  const { t } = useTranslation("experimentVisualizations");
  const locale = useLocale();

  return (
    <p className="text-muted-foreground shrink-0 px-3 py-2 text-xs">
      {t("charts.truncated", {
        shown: formatLocaleNumber(truncation.shown, locale),
        total: formatLocaleNumber(truncation.total, locale),
      })}
    </p>
  );
}
