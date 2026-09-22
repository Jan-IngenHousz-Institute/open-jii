"use client";

import type {
  CalibrationRunPayload,
  CalibrationWriteResults,
  DeviceCalibration,
} from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";
import type { ProcedureProgress } from "@repo/iot";
import { Alert, AlertDescription } from "@repo/ui/components/alert";

import { CalibrationSeriesTable } from "../result/calibration-series-table";
import { CalibrationCaptureProgress } from "./calibration-capture-progress";
import { CalibrationWriteBlock } from "./calibration-write-block";

interface CalibrationWriteStepProps {
  applied: DeviceCalibration;
  canWrite: boolean;
  results: CalibrationWriteResults | null;
  error: string | null;
  /** The write reached the device; recording it did not. The two are separate failures. */
  reportError: string | null;
  isDisconnected: boolean;
  verifyEvents: ProcedureProgress[];
  isVerifying: boolean;
  verification: CalibrationRunPayload | null;
  verificationError: string | null;
}

/** Approval alone changes nothing on the hardware; this step does. The write itself is the wizard's action. */
export function CalibrationWriteStep({
  applied,
  canWrite,
  results,
  error,
  reportError,
  isDisconnected,
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

  // Every block that is about to go to the device, then what became of each one.
  function renderBlock([name, block]: (typeof blocks)[number]) {
    return <CalibrationWriteBlock key={name} name={name} block={block} result={results?.[name]} />;
  }

  function renderSeries([series, rows]: [string, CalibrationRunPayload[string]]) {
    return <CalibrationSeriesTable key={series} series={series} rows={rows} />;
  }

  function renderCheck() {
    if (!showsCheck) return null;
    return (
      <section className="space-y-3">
        <h3 className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          {t("iot.calibration.write.verifyHeading")}
        </h3>
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
      </section>
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
    <div className="space-y-6">
      {error !== null && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {isDisconnected && results === null && (
        <Alert variant="destructive">
          <AlertDescription>{t("iot.calibration.write.disconnected")}</AlertDescription>
        </Alert>
      )}
      {reportError !== null && (
        <Alert variant="destructive">
          <AlertDescription>
            {t("iot.calibration.write.reportFailed")}
            <span className="mt-1 block font-mono text-xs">{reportError}</span>
          </AlertDescription>
        </Alert>
      )}
      <div className="grid gap-3 md:grid-cols-2">{blocks.map(renderBlock)}</div>
      {hasUnconfirmedBlock && (
        <Alert variant="destructive">
          <AlertDescription>{t("iot.calibration.write.partial")}</AlertDescription>
        </Alert>
      )}
      {renderCheck()}
    </div>
  );
}
