"use client";

import { ChevronDown } from "lucide-react";

import type {
  CalibrationRun,
  ActiveDeviceCalibration,
  CalibrationOutputSchema,
  CalibrationRunPayload,
} from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/collapsible";

import { CalibrationBlockCard } from "../result/calibration-block-card";
import { CalibrationSeriesTable } from "../result/calibration-series-table";

interface CalibrationReviewProps {
  run: CalibrationRun;
  payload: CalibrationRunPayload;
  active: ActiveDeviceCalibration | null;
  /** The bounds the definition declared, so each coefficient reads against what it may be. */
  outputSchema?: CalibrationOutputSchema;
}

/**
 * The evidence a decision rests on: the fit, each block beside what is in force, and every
 * point the bench measured. The decision itself belongs to the wizard's action row.
 */
export function CalibrationReview({ run, payload, active, outputSchema }: CalibrationReviewProps) {
  const { t } = useTranslation("iot");

  const blocks = Object.entries(run.blocks ?? {});
  const series = Object.entries(payload);
  const isComputed = run.status === "computed";

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
        spec={outputSchema?.blocks[name]}
      />
    );
  }

  /**
   * Every point the bench took, one table per series, folded away.
   *
   * They are the evidence behind a point that went wrong, so they have to be here; open,
   * they run to several screens and put the decision below the fold.
   */
  function renderReadings() {
    if (series.length === 0) return null;
    const points = series.reduce((total, [, rows]) => total + rows.length, 0);

    return (
      <Collapsible>
        {/* A button centres its own text, which a label that wraps on a phone makes obvious. */}
        <CollapsibleTrigger className="text-muted-foreground hover:text-foreground group flex items-start gap-1.5 text-left text-sm">
          <ChevronDown
            className="mt-0.5 size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180"
            aria-hidden
          />
          {t("iot.calibration.review.showReadings", { series: series.length, points })}
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-3">
          {series.map(renderSeries)}
        </CollapsibleContent>
      </Collapsible>
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
      <div className="grid gap-4 md:grid-cols-2">{blocks.map(renderBlock)}</div>
      {renderReadings()}
    </div>
  );
}
