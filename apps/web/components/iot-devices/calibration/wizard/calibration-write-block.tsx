"use client";

import { CheckCircle2, CircleDashed, XCircle } from "lucide-react";

import type {
  CalibrationWriteResults,
  DeviceCalibration,
} from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";
import { cn } from "@repo/ui/lib/utils";

import { formatCoefficientValue } from "../result/format-coefficient-value";

type AppliedBlock = DeviceCalibration["blocks"][string];
type WriteResult = CalibrationWriteResults[string];

interface CalibrationWriteBlockProps {
  name: string;
  block: AppliedBlock;
  /** Absent until the write has reached this block. */
  result: WriteResult | undefined;
}

/**
 * One block on its way to the device: what will be sent, then what became of it.
 *
 * The coefficients get the same room they had on the review, because this is the last place
 * a reviewer can still catch one that is not what they approved a step earlier.
 */
export function CalibrationWriteBlock({ name, block, result }: CalibrationWriteBlockProps) {
  const { t } = useTranslation("iot");

  const coefficients = Object.entries(block.coefficients);

  function renderOutcome() {
    if (result === undefined) {
      return (
        <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
          <CircleDashed className="size-3.5 shrink-0" aria-hidden />
          {t("iot.calibration.write.pending")}
        </span>
      );
    }
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-xs font-medium",
          result.verified ? "text-status-active-foreground" : "text-destructive",
        )}
      >
        {result.verified ? (
          <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
        ) : (
          <XCircle className="size-3.5 shrink-0" aria-hidden />
        )}
        {result.verified ? t("iot.calibration.write.verified") : t("iot.calibration.write.failed")}
      </span>
    );
  }

  // Stacked, like the review card that showed the same numbers a step earlier: right-aligned
  // across a narrow card, a six-element vector wraps and strands its closing bracket.
  function renderCoefficient([coefficient, value]: (typeof coefficients)[number]) {
    return (
      <div key={coefficient} className="space-y-0.5">
        <dt className="text-muted-foreground text-xs">{coefficient}</dt>
        <dd className="wrap-break-word font-mono text-sm">{formatCoefficientValue(value)}</dd>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{name}</p>
        {renderOutcome()}
      </div>
      <dl className="space-y-2">{coefficients.map(renderCoefficient)}</dl>
      {result?.error !== undefined && (
        <p className="text-destructive font-mono text-xs">{result.error}</p>
      )}
    </div>
  );
}
