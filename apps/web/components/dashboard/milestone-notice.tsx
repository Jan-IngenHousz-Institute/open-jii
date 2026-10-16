"use client";

import { formatLocaleNumber } from "@/util/format-locale-number";

import type { MetricsCaption } from "@repo/api/domains/metrics/metrics.schema";
import { useTranslation } from "@repo/i18n";

import { NoticeLine } from "./notice-line";

interface MilestoneNoticeProps {
  milestone: Extract<MetricsCaption, { kind: "milestone" }>;
  locale: string;
  onDismiss: () => void;
}

export function MilestoneNotice({ milestone, locale, onDismiss }: MilestoneNoticeProps) {
  const { t } = useTranslation("publicMetrics");

  const formattedDate = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(milestone.date));

  return (
    <NoticeLine onDismiss={onDismiss}>
      {t("dashboard.milestone", {
        ordinal: formatLocaleNumber(milestone.ordinal, locale),
        date: formattedDate,
      })}
    </NoticeLine>
  );
}
