"use client";

import { CheckCircle2, Loader2, SkipForward } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import type { ProcedureProgress } from "@repo/iot";

export function CalibrationCaptureProgress({
  events,
  isRunning,
}: {
  events: ProcedureProgress[];
  isRunning: boolean;
}) {
  const { t } = useTranslation("iot");

  const current = events.findLast((event) => event.kind === "step");
  const setpoint = events.findLast((event) => event.kind === "setpoint");
  const completed = events.filter((event) => event.kind === "series" || event.kind === "skipped");

  function renderCompleted(event: ProcedureProgress, index: number) {
    if (event.kind === "series") {
      return (
        <li key={index} className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="text-status-active size-4" aria-hidden />
          {t("iot.calibration.capture.series", { series: event.series, rows: event.rows })}
        </li>
      );
    }
    if (event.kind === "skipped") {
      return (
        <li key={index} className="text-muted-foreground flex items-center gap-2 text-sm">
          <SkipForward className="size-4" aria-hidden />
          {t("iot.calibration.capture.skipped", { series: event.series, reason: event.reason })}
        </li>
      );
    }
    return null;
  }

  return (
    <div className="space-y-3" aria-live="polite">
      {isRunning && current?.kind === "step" && (
        <p className="flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t("iot.calibration.capture.step", {
            index: current.index + 1,
            total: current.total,
            description: current.description,
          })}
        </p>
      )}
      {isRunning && setpoint?.kind === "setpoint" && (
        <p className="text-muted-foreground text-xs">
          {t("iot.calibration.capture.setpoint", {
            index: setpoint.index + 1,
            total: setpoint.total,
            value: String(setpoint.value),
          })}
        </p>
      )}
      {completed.length > 0 && <ul className="space-y-1">{completed.map(renderCompleted)}</ul>}
    </div>
  );
}
