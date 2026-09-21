"use client";

import { ScatterChart } from "@/components/charts/scatter-chart";
import { useMemo } from "react";

import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import { useTranslation } from "@repo/i18n";
import type { ProcedureProgress } from "@repo/iot";

import { liveSeriesData } from "./live-series-data";

interface CalibrationLiveSeriesProps {
  events: ProcedureProgress[];
  procedure: CaptureProcedure | undefined;
}

/**
 * The sweep as it is being measured.
 *
 * Before this the bench showed a progress bar and named the setpoint, and the readings only
 * became visible as a table once the whole session was over. A point that went wrong was
 * therefore found after the rig had been packed away. The curve drawing itself is what puts
 * that back in the operator's hands while the bench is still standing.
 */
export function CalibrationLiveSeries({ events, procedure }: CalibrationLiveSeriesProps) {
  const { t } = useTranslation("iot");
  const live = useMemo(() => liveSeriesData(events, procedure), [events, procedure]);

  if (live === null || live.traces.length === 0) {
    return null;
  }

  const data = live.traces.map((trace) => ({ ...trace, mode: "lines+markers" as const }));

  return (
    <section className="space-y-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-sm font-medium">{live.series}</p>
        <p className="text-muted-foreground text-xs tabular-nums">
          {live.expected === null
            ? t("iot.calibration.capture.pointsTaken", { taken: live.taken })
            : t("iot.calibration.capture.pointsOf", {
                taken: live.taken,
                total: live.expected,
              })}
        </p>
      </div>
      <ScatterChart className="h-52" data={data} config={{ showLegend: live.traces.length > 1 }} />
    </section>
  );
}
