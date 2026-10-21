"use client";

import { useLocalDateFormat } from "@/hooks/useLocalDateFormat";
import { useLocale } from "@/hooks/useLocale";

import type { SkippedPlot } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";

export function SkippedPlotRow({ plot }: { plot: SkippedPlot }) {
  const { t } = useTranslation("datasets");
  const locale = useLocale();
  const format = useLocalDateFormat(locale);

  return (
    <li className="flex items-center gap-4 py-2.5 first:pt-0 last:pb-0">
      <p className="w-24 shrink-0 font-medium">{plot.plot}</p>
      <Badge variant="outline" className="font-normal">
        {t(`plotChecks.reasons.${plot.reason}`)}
      </Badge>
      <p className="text-muted-foreground text-sm">
        {t("plotChecks.skippedBy", {
          name: plot.skippedByName,
          date: format.date(plot.skippedAt),
        })}
      </p>
    </li>
  );
}
