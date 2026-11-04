"use client";

import { useFormat } from "~/hooks/use-format";

import { useTranslation } from "@repo/i18n/client";
import type { Incident } from "@repo/monitoring/status-document";

import type { DaySummary } from "./day-summary";

interface DayDetailsProps {
  summary: DaySummary;
  checksBegan: string;
}

export function DayDetails({ summary, checksBegan }: DayDetailsProps) {
  const { t } = useTranslation("status");
  const format = useFormat();

  function renderRow(row: DaySummary["rows"][number]) {
    return (
      <li key={row.kind} className="bg-muted flex justify-between rounded px-2 py-1.5">
        <span className="font-medium">{t(`day.row.${row.kind}`)}</span>
        <span className="tabular-nums">{format.duration(row.minutes)}</span>
      </li>
    );
  }

  function renderIncident(incident: Incident) {
    return (
      <p key={incident.id} className="mt-1">
        {incident.title}
      </p>
    );
  }

  if (summary.isBeforeRecords) {
    return (
      <p className="text-muted-foreground px-4 pb-3 pt-1">
        {t("day.noRecord", { date: format.date(checksBegan) })}
      </p>
    );
  }

  const hasRows = summary.rows.length > 0;
  const hasRelated = summary.related.length > 0;

  return (
    <>
      {hasRows ? (
        <ul className="mx-2 mb-2 mt-2 flex flex-col gap-1">{summary.rows.map(renderRow)}</ul>
      ) : (
        <p className="text-muted-foreground px-4 pb-3 pt-1">{t("day.noDowntime")}</p>
      )}
      {hasRelated ? (
        <div className="border-border border-t px-4 py-3">
          <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
            {t("day.related")}
          </p>
          {summary.related.map(renderIncident)}
        </div>
      ) : null}
    </>
  );
}
