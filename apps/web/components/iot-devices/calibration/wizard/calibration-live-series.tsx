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
 * The curve drawing itself is what puts a bad point in the operator's hands while the rig
 * is still standing, rather than in a table once the session is over.
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
      {/* The legend is what names the reading, so it stays on even for a single trace. */}
      <ScatterChart
        className="h-52"
        data={data}
        config={{
          xAxisTitle: live.xLabel ?? undefined,
          showLegend: true,
          legendPosition: "bottom",
          displayModeBar: false,
        }}
      />
    </section>
  );
}
