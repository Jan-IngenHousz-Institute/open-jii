"use client";

import { CELL, HISTORY_LEGEND } from "~/lib/history-cells";

import { useTranslation } from "@repo/i18n/client";
import type { DayState } from "@repo/monitoring/status-document";
import { cn } from "@repo/ui/lib/utils";

export function HistoryLegend() {
  const { t } = useTranslation("status");

  function renderState(state: DayState) {
    return (
      <li key={state} className="inline-flex items-center gap-1.5">
        <span aria-hidden className={cn("inline-block h-4 w-2 rounded-[2px]", CELL[state])} />
        {t(`legend.${state}`)}
      </li>
    );
  }

  return (
    <ul
      aria-label={t("history.legend")}
      className="text-muted-foreground flex flex-wrap gap-4 text-xs"
    >
      {HISTORY_LEGEND.map(renderState)}
    </ul>
  );
}
