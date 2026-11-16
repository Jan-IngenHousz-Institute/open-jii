"use client";

import { useTranslation } from "@repo/i18n/client";
import type { DayRecord, Incident } from "@repo/monitoring/status-document";

import { problemDays } from "./day-summary";
import type { ProblemDay } from "./day-summary";
import { ProblemDayItem } from "./problem-day-item";

interface ProblemDaysProps {
  days: DayRecord[];
  incidents: Incident[];
  generatedAt: string;
  checksBegan: string;
}

export function ProblemDays({ days, incidents, generatedAt, checksBegan }: ProblemDaysProps) {
  const { t } = useTranslation("status");
  const listed = problemDays(days, incidents, generatedAt);

  function renderDay({ day, summary }: ProblemDay) {
    return <ProblemDayItem key={day.date} day={day} summary={summary} checksBegan={checksBegan} />;
  }

  return (
    <div className="mt-4 text-sm">
      <p className="font-semibold">{t("history.problemDays")}</p>
      {listed.length === 0 ? (
        <p className="text-muted-foreground mt-1">{t("history.noProblemDays")}</p>
      ) : (
        <ul className="mt-1 list-disc space-y-1 pl-5">{listed.map(renderDay)}</ul>
      )}
    </div>
  );
}
