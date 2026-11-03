"use client";

import { useDayLabel } from "~/hooks/use-day-label";
import type { DaySummary } from "~/lib/day-summary";

import type { DayRecord } from "@repo/monitoring/status-document";

interface ProblemDayItemProps {
  day: DayRecord;
  summary: DaySummary;
  checksBegan: string;
}

export function ProblemDayItem({ day, summary, checksBegan }: ProblemDayItemProps) {
  const label = useDayLabel(day.date, summary, checksBegan);

  return <li>{label}</li>;
}
