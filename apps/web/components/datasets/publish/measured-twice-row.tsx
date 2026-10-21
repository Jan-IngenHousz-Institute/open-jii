"use client";

import { StatusBadge } from "@/components/shared/status-badge";
import { useLocalDateFormat } from "@/hooks/useLocalDateFormat";
import { useLocale } from "@/hooks/useLocale";
import { TriangleAlert } from "lucide-react";

import type {
  MeasuredTwicePlot,
  MeasuredTwiceReading,
} from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

import { ReadingValues } from "./reading-values";

/** One plot measured twice, with every reading on it, resolved in the Layout tab's panel. */
export function MeasuredTwiceRow({ plot }: { plot: MeasuredTwicePlot }) {
  const { t } = useTranslation("datasets");
  const locale = useLocale();
  const format = useLocalDateFormat(locale);

  const renderReading = (reading: MeasuredTwiceReading) => (
    <li key={reading.rowId}>
      <p className="text-sm">
        {t("plotChecks.readingBy", {
          name: reading.measuredByName,
          date: format.dateTime(reading.measuredAt),
        })}
      </p>
      <ReadingValues values={reading.values} />
    </li>
  );

  return (
    <li className="flex items-start gap-4 py-3 first:pt-0 last:pb-0">
      <div className="w-24 shrink-0 space-y-1.5">
        <p className="font-medium">{plot.plot}</p>
        <StatusBadge tone="stale">
          <TriangleAlert aria-hidden />
          {t("plotChecks.holds")}
        </StatusBadge>
      </div>
      <ul className="min-w-0 flex-1 space-y-2">{plot.readings.map(renderReading)}</ul>
      <Button type="button" variant="outline" size="sm" className="shrink-0">
        {t("plotChecks.resolve")}
      </Button>
    </li>
  );
}
