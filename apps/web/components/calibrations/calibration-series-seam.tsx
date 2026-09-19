"use client";

import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";

import type { ProducedSeries } from "./produced-series";

interface CalibrationSeriesSeamProps {
  series: ProducedSeries[];
}

/**
 * What the capture hands the fit, on the seam between them.
 *
 * The script addresses these by name and nothing checks the spelling until a bench run
 * fails, so the names an author has to type are kept in front of them while they type.
 */
export function CalibrationSeriesSeam({ series }: CalibrationSeriesSeamProps) {
  const { t } = useTranslation("iot");

  if (series.length === 0) {
    return (
      <p className="text-muted-foreground border-l py-2 pl-6 text-xs">
        {t("iot.calibration.seam.recordsNothing")}
      </p>
    );
  }

  function renderSeries(produced: ProducedSeries) {
    return (
      <li key={produced.name} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <code className="text-foreground text-xs font-medium">
          inputs[&quot;{produced.name}&quot;]
        </code>
        {produced.optional && (
          <Badge variant="outline" className="text-[10px]">
            {t("iot.calibration.seam.optional")}
          </Badge>
        )}
        <span className="text-muted-foreground text-xs">{produced.columns.join(" · ")}</span>
      </li>
    );
  }

  return (
    <div className="border-l py-2 pl-6">
      <p className="text-muted-foreground mb-1 text-xs">{t("iot.calibration.seam.produces")}</p>
      <ul className="space-y-1">{series.map(renderSeries)}</ul>
    </div>
  );
}
