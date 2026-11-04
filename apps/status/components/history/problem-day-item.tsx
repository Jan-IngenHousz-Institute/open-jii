"use client";

import type { DayRecord } from "@repo/monitoring/status-document";

import type { DaySummary } from "./day-summary";
import { useDayLabel } from "./use-day-label";

interface ProblemDayItemProps {
  day: DayRecord;
  summary: DaySummary;
  checksBegan: string;
}

export function ProblemDayItem({ day, summary, checksBegan }: ProblemDayItemProps) {
  const label = useDayLabel(day.date, summary, checksBegan);

  return <li>{label}</li>;
}
