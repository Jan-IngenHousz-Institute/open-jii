"use client";

import type { DaySummary } from "~/lib/day-summary";

import { useTranslation } from "@repo/i18n/client";

import { useFormat } from "./use-format";

export function useDayLabel(
  date: string,
  summary: DaySummary,
  checksBegan: string,
  isToday = false,
) {
  const { t } = useTranslation("status");
  const format = useFormat();
  const day = isToday ? t("day.aria.todayDate", { date: format.date(date) }) : format.date(date);

  if (summary.isBeforeRecords) {
    return t("day.aria.noRecord", { date: day, began: format.date(checksBegan) });
  }

  const clauses = summary.rows.map((row) =>
    t(`day.aria.${row.kind}`, { duration: format.duration(row.minutes) }),
  );

  if (summary.related.length > 0) {
    const titles = format.names(summary.related.map((incident) => incident.title));
    clauses.push(t("day.aria.related", { titles }));
  }

  return clauses.length === 0
    ? t("day.aria.noDowntime", { date: day })
    : t("day.aria.summary", { date: day, summary: format.clauses(clauses) });
}
