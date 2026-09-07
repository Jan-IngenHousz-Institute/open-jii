"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import type {
  CalibrationWriteResults,
  DeviceCalibration,
} from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";

interface CalibrationWriteStepProps {
  applied: DeviceCalibration;
  canWrite: boolean;
  results: CalibrationWriteResults | null;
  isWriting: boolean;
  error: string | null;
  onWrite: () => void;
  onFinish: () => void;
}

/**
 * Put the approved coefficients on the device and say, block by block,
 * whether the device confirmed them. Approval alone changes nothing on the
 * hardware; this is the step that does.
 */
export function CalibrationWriteStep({
  applied,
  canWrite,
  results,
  isWriting,
  error,
  onWrite,
  onFinish,
}: CalibrationWriteStepProps) {
  const { t } = useTranslation("iot");

  const isWritten = results !== null;
  const blockNames = Object.keys(applied.blocks);

  function renderResult(block: string) {
    const result = results?.[block];
    if (!result) return null;
    return (
      <li key={block} className="flex items-start gap-2 text-sm">
        {result.verified ? (
          <CheckCircle2 className="text-status-active mt-0.5 size-4" aria-hidden />
        ) : (
          <XCircle className="text-destructive mt-0.5 size-4" aria-hidden />
        )}
        <span>
          <span className="font-medium">{block}</span>{" "}
          {result.verified
            ? t("iot.calibration.write.verified")
            : t("iot.calibration.write.failed")}
          {result.error !== undefined && (
            <span className="text-muted-foreground block font-mono text-xs">{result.error}</span>
          )}
        </span>
      </li>
    );
  }

  if (!canWrite) {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertDescription>{t("iot.calibration.write.unsupported")}</AlertDescription>
        </Alert>
        <Button type="button" variant="outline" onClick={onFinish}>
          {t("iot.calibration.write.skip")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{t("iot.calibration.write.hint")}</p>
      {error !== null && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {isWritten && <ul className="space-y-1">{blockNames.map(renderResult)}</ul>}
      <div className="flex gap-2">
        {!isWritten && (
          <Button type="button" onClick={onWrite} disabled={isWriting}>
            {isWriting && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
            {isWriting ? t("iot.calibration.write.writing") : t("iot.calibration.write.action")}
          </Button>
        )}
        {isWritten && (
          <Button type="button" onClick={onFinish}>
            {t("iot.calibration.done.close")}
          </Button>
        )}
      </div>
    </div>
  );
}
