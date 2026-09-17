"use client";

import { Loader2 } from "lucide-react";

import type {
  CalibrationRun,
  ActiveDeviceCalibration,
  CalibrationRunPayload,
} from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";

import { CalibrationBlockCard } from "../result/calibration-block-card";
import { CalibrationFitChart } from "../result/calibration-fit-chart";
import { CalibrationSeriesTable } from "../result/calibration-series-table";
import { fitLineFromBlocks, fitPointsFromPayload } from "../result/fit-points";

interface CalibrationReviewProps {
  run: CalibrationRun;
  payload: CalibrationRunPayload;
  active: ActiveDeviceCalibration | null;
  isApproving: boolean;
  isRejecting: boolean;
  onApprove: () => void;
  onReject: () => void;
}

export function CalibrationReview({
  run,
  payload,
  active,
  isApproving,
  isRejecting,
  onApprove,
  onReject,
}: CalibrationReviewProps) {
  const { t } = useTranslation("iot");

  const blocks = Object.entries(run.blocks ?? {});
  const isComputed = run.status === "computed";
  const isBusy = isApproving || isRejecting;
  const points = fitPointsFromPayload(payload);

  function renderChart() {
    const line = fitLineFromBlocks(run.blocks);
    if (line === null || points.length === 0) return null;
    return <CalibrationFitChart points={points} slope={line.slope} intercept={line.intercept} />;
  }

  function renderSeries([series, rows]: [string, CalibrationRunPayload[string]]) {
    return <CalibrationSeriesTable key={series} series={series} rows={rows} />;
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
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">{t("iot.calibration.review.hint")}</p>
      {renderChart()}
      <div className="grid gap-4 md:grid-cols-2">{blocks.map(renderBlock)}</div>
      <div className="space-y-4">{Object.entries(payload).map(renderSeries)}</div>
      <div className="flex gap-2">
        <Button type="button" onClick={onApprove} disabled={isBusy}>
          {isApproving && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
          {t("iot.calibration.review.approve")}
        </Button>
        <Button type="button" variant="outline" onClick={onReject} disabled={isBusy}>
          {isRejecting && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
          {t("iot.calibration.review.reject")}
        </Button>
      </div>
    </div>
  );
}
