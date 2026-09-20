"use client";

import type {
  CalibrationRun,
  ActiveDeviceCalibration,
  CalibrationRunPayload,
} from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";
import { Alert, AlertDescription } from "@repo/ui/components/alert";

import { CalibrationBlockCard } from "../result/calibration-block-card";
import { CalibrationFitChart } from "../result/calibration-fit-chart";
import { CalibrationSeriesTable } from "../result/calibration-series-table";
import { fitLineFromBlocks, fitPointsFromPayload } from "../result/fit-points";

interface CalibrationReviewProps {
  run: CalibrationRun;
  payload: CalibrationRunPayload;
  active: ActiveDeviceCalibration | null;
}

/**
 * The evidence a decision rests on: the fit, each block beside what is in force, and every
 * point the bench measured. The decision itself belongs to the wizard's action row.
 */
export function CalibrationReview({ run, payload, active }: CalibrationReviewProps) {
  const { t } = useTranslation("iot");

  const blocks = Object.entries(run.blocks ?? {});
  const series = Object.entries(payload);
  const isComputed = run.status === "computed";
  const points = fitPointsFromPayload(payload);

  function renderChart() {
    const line = fitLineFromBlocks(run.blocks);
    if (line === null || points.length === 0) return null;
    return <CalibrationFitChart points={points} slope={line.slope} intercept={line.intercept} />;
  }

  function renderSeries([name, rows]: [string, CalibrationRunPayload[string]]) {
    return <CalibrationSeriesTable key={name} series={name} rows={rows} />;
  }

  function renderBlock([name, block]: (typeof blocks)[number]) {
    return (
      <CalibrationBlockCard
        key={name}
        name={name}
        block={block}
        previous={{ coefficients: active?.blocks[name]?.coefficients }}
      />
    );
  }

  function renderReadings() {
    if (series.length === 0) return null;
    return (
      <section className="space-y-3">
        <h3 className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          {t("iot.calibration.run.readings")}
        </h3>
        {series.map(renderSeries)}
      </section>
    );
  }

  // A failed compute still carries each block's reason; only the decision is withheld.
  if (!isComputed) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertDescription>
            {t("iot.calibration.review.computeFailed")}
            {run.errorMessage !== null && (
              <span className="mt-1 block font-mono text-xs">{run.errorMessage}</span>
            )}
          </AlertDescription>
        </Alert>
        {blocks.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">{blocks.map(renderBlock)}</div>
        )}
        {renderReadings()}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {renderChart()}
      <div className="grid gap-4 md:grid-cols-2">{blocks.map(renderBlock)}</div>
      {renderReadings()}
    </div>
  );
}
