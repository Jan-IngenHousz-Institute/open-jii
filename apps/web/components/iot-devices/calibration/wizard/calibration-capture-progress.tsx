"use client";

import { CheckCircle2, SkipForward } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import type { ProcedureProgress } from "@repo/iot";
import { Progress } from "@repo/ui/components/progress";

import { formatSeriesValue } from "../result/format-series-value";

interface CalibrationCaptureProgressProps {
  events: ProcedureProgress[];
  isRunning: boolean;
  /**
   * The operator is being asked something. The request states the step in its own words,
   * so the bar keeps the count and drops the description rather than printing it twice.
   */
  isWaitingOnOperator?: boolean;
}

export function CalibrationCaptureProgress({
  events,
  isRunning,
  isWaitingOnOperator = false,
}: CalibrationCaptureProgressProps) {
  const { t } = useTranslation("iot");

  const current = events.findLast((event) => event.kind === "step");
  const setpoint = events.findLast((event) => event.kind === "setpoint");
  const completed = events.filter((event) => event.kind === "series" || event.kind === "skipped");

  const step = isRunning && current?.kind === "step" ? current : null;
  const hasSetpoint = isRunning && setpoint?.kind === "setpoint";
  // Steps behind the one running, as a share of the procedure.
  const percentDone = step === null ? 0 : Math.round((step.index / step.total) * 100);

  function renderCompleted(event: ProcedureProgress, index: number) {
    if (event.kind === "series") {
      return (
        <li key={index} className="flex items-center gap-2">
          <CheckCircle2 className="text-status-active size-4 shrink-0" aria-hidden />
          {t("iot.calibration.capture.series", { series: event.series, rows: event.rows })}
        </li>
      );
    }
    if (event.kind === "skipped") {
      return (
        <li key={index} className="text-muted-foreground flex items-center gap-2">
          <SkipForward className="size-4 shrink-0" aria-hidden />
          {t("iot.calibration.capture.skipped", { series: event.series, reason: event.reason })}
        </li>
      );
    }
    return null;
  }

  function renderRunning() {
    if (step === null) {
      return null;
    }
    return (
      <div className="space-y-2">
        <Progress value={percentDone} className="h-1.5" />
        <p className="text-sm font-medium">
          {isWaitingOnOperator
            ? t("iot.calibration.capture.stepCounter", {
                index: step.index + 1,
                total: step.total,
              })
            : t("iot.calibration.capture.step", {
                index: step.index + 1,
                total: step.total,
                description: step.description,
              })}
        </p>
        {hasSetpoint && (
          <p className="text-muted-foreground text-xs">
            {t("iot.calibration.capture.setpoint", {
              index: setpoint.index + 1,
              total: setpoint.total,
              value: formatSeriesValue(setpoint.value),
            })}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4" aria-live="polite">
      {renderRunning()}
      {completed.length > 0 && (
        <ul className="space-y-1.5 text-sm">{completed.map(renderCompleted)}</ul>
      )}
    </div>
  );
}
