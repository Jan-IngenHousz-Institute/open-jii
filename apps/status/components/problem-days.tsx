"use client";

import { problemDays } from "~/lib/day-summary";
import type { ProblemDay } from "~/lib/day-summary";

import { useTranslation } from "@repo/i18n/client";
import type { DayRecord, Incident } from "@repo/monitoring/status-document";

import { ProblemDayItem } from "./problem-day-item";

interface ProblemDaysProps {
  days: DayRecord[];
  incidents: Incident[];
  checksBegan: string;
}

export function ProblemDays({ days, incidents, checksBegan }: ProblemDaysProps) {
  const { t } = useTranslation("status");
  const listed = problemDays(days, incidents);

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
