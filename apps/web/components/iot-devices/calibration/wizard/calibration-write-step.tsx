"use client";

import { CheckCircle2, CircleDashed, XCircle } from "lucide-react";

import type {
  CalibrationRunPayload,
  CalibrationWriteResults,
  DeviceCalibration,
} from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";
import type { ProcedureProgress } from "@repo/iot";
import { Alert, AlertDescription } from "@repo/ui/components/alert";

import { CalibrationSeriesTable } from "../result/calibration-series-table";
import { formatCoefficientValue } from "../result/format-coefficient-value";
import { CalibrationCaptureProgress } from "./calibration-capture-progress";

interface CalibrationWriteStepProps {
  applied: DeviceCalibration;
  canWrite: boolean;
  results: CalibrationWriteResults | null;
  error: string | null;
  verifyEvents: ProcedureProgress[];
  isVerifying: boolean;
  verification: CalibrationRunPayload | null;
  verificationError: string | null;
}

type AppliedBlock = DeviceCalibration["blocks"][string];
type WriteResult = CalibrationWriteResults[string];

/** Approval alone changes nothing on the hardware; this step does. The write itself is the wizard's action. */
export function CalibrationWriteStep({
  applied,
  canWrite,
  results,
  error,
  verifyEvents,
  isVerifying,
  verification,
  verificationError,
}: CalibrationWriteStepProps) {
  const { t } = useTranslation("iot");

  const blocks = Object.entries(applied.blocks);
  // Nothing is rolled back, so an unconfirmed block can have reached the device
  // in part. The operator has to know before the unit goes back into service.
  const hasUnconfirmedBlock = Object.values(results ?? {}).some((result) => !result.verified);
  const hasVerification = verification !== null && Object.keys(verification).length > 0;
  const showsCheck =
    isVerifying || verifyEvents.length > 0 || hasVerification || verificationError !== null;

  function renderOutcomeIcon(result: WriteResult | undefined) {
    if (result === undefined) {
      return <CircleDashed className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />;
    }
    return result.verified ? (
      <CheckCircle2 className="text-status-active mt-0.5 size-4 shrink-0" aria-hidden />
    ) : (
      <XCircle className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden />
    );
  }

  function formatCoefficients(block: AppliedBlock) {
    return Object.entries(block.coefficients)
      .map(([name, value]) => `${name} ${formatCoefficientValue(value)}`)
      .join(", ");
  }

  // Every block that is about to go to the device, then what became of each one.
  function renderBlock([name, block]: (typeof blocks)[number]) {
    const result = results?.[name];
    return (
      <li key={name} className="flex items-start gap-2 text-sm">
        {renderOutcomeIcon(result)}
        <span className="min-w-0">
          <span className="font-medium">{name}</span>
          {result !== undefined && (
            <span className="text-muted-foreground">
              {" "}
              {result.verified
                ? t("iot.calibration.write.verified")
                : t("iot.calibration.write.failed")}
            </span>
          )}
          <span className="text-muted-foreground block font-mono text-xs">
            {formatCoefficients(block)}
          </span>
          {result?.error !== undefined && (
            <span className="text-muted-foreground block font-mono text-xs">{result.error}</span>
          )}
        </span>
      </li>
    );
  }

  function renderSeries([series, rows]: [string, CalibrationRunPayload[string]]) {
    return <CalibrationSeriesTable key={series} series={series} rows={rows} />;
  }

  function renderCheck() {
    if (!showsCheck) return null;
    return (
      <div className="space-y-3 rounded-md border p-4">
        <p className="text-sm font-medium">{t("iot.calibration.write.verifyHeading")}</p>
        {isVerifying && (
          <p className="text-muted-foreground text-sm">{t("iot.calibration.write.verifying")}</p>
        )}
        <CalibrationCaptureProgress events={verifyEvents} isRunning={isVerifying} />
        {verificationError !== null && (
          <Alert variant="destructive">
            <AlertDescription>
              {t("iot.calibration.write.verificationStopped", { reason: verificationError })}
            </AlertDescription>
          </Alert>
        )}
        {hasVerification && (
          <div className="space-y-3">{Object.entries(verification).map(renderSeries)}</div>
        )}
      </div>
    );
  }

  if (!canWrite) {
    return (
      <Alert>
        <AlertDescription>{t("iot.calibration.write.unsupported")}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {error !== null && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <ul className="space-y-2">{blocks.map(renderBlock)}</ul>
      {hasUnconfirmedBlock && (
        <Alert variant="destructive">
          <AlertDescription>{t("iot.calibration.write.partial")}</AlertDescription>
        </Alert>
      )}
      {renderCheck()}
    </div>
  );
}
