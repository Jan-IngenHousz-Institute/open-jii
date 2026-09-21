"use client";

import { StatusBadge } from "@/components/shared/status-badge";
import type { StatusTone } from "@/components/shared/status-badge";
import { Check, X } from "lucide-react";

import type {
  CalibrationBlock,
  CalibrationBlockStatus,
} from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";
import { cn } from "@repo/ui/lib/utils";

import { CalibrationBlockChart } from "./calibration-block-chart";
import { formatCoefficientValue } from "./format-coefficient-value";

const BLOCK_STATUS_TONE: Record<CalibrationBlockStatus, StatusTone> = {
  computed: "published",
  rejected: "destructive",
  skipped: "archived",
};

interface CalibrationBlockCardProps {
  name: string;
  block: CalibrationBlock;
  /**
   * What these coefficients are held against: the ones in force at review time, whose
   * own absence is worth showing, or null on a session read back from the record, where
   * what the run replaced is no longer knowable.
   */
  previous: { coefficients: Record<string, number | number[]> | undefined } | null;
}

export function CalibrationBlockCard({ name, block, previous }: CalibrationBlockCardProps) {
  const { t } = useTranslation("iot");

  const quality = block.quality;
  const isPassed = quality?.passed === true;
  const reasons = Array.isArray(quality?.reasons) ? quality.reasons.map(String) : [];
  const r2 = typeof quality?.r2 === "number" ? quality.r2 : null;
  const nrmse = typeof quality?.nrmse === "number" ? quality.nrmse : null;
  // Which reading made the fit poor, named by the setpoint that produced it. The index is
  // only meaningful inside what the script fitted, which can be a subset of a series.
  const worstStimulus = quality?.worst_stimulus;
  const worstFraction =
    typeof quality?.worst_residual_fraction === "number" ? quality.worst_residual_fraction : null;
  const hasWorstPoint =
    worstFraction !== null &&
    Number.isFinite(worstFraction) &&
    (typeof worstStimulus === "number" || typeof worstStimulus === "string");
  const hasComparison = previous !== null;

  /**
   * The new value, then what it replaced. A recalibration that lands on the same number
   * is the common case, and printing it twice with an arrow between buried the ones that
   * did move; what the reviewer needs from an unchanged coefficient is the word.
   */
  function renderCoefficient([coefficient, value]: [string, number | number[]]) {
    const before = previous?.coefficients?.[coefficient];
    const formatted = formatCoefficientValue(value);
    const formattedBefore = before === undefined ? null : formatCoefficientValue(before);

    return (
      <div key={coefficient} className="space-y-0.5">
        <dt className="text-muted-foreground text-xs">{coefficient}</dt>
        <dd className="break-words font-mono text-sm">{formatted}</dd>
        {hasComparison && (
          <dd className="text-muted-foreground text-xs">
            {formattedBefore === null ? (
              t("iot.calibration.review.previousUnknown")
            ) : formattedBefore === formatted ? (
              t("iot.calibration.review.unchanged")
            ) : (
              <>
                {t("iot.calibration.review.previousLabel")}{" "}
                <span className="font-mono">{formattedBefore}</span>
              </>
            )}
          </dd>
        )}
      </div>
    );
  }

  function renderQuality() {
    if (!quality) return null;
    return (
      <div className="space-y-1 border-t pt-3 text-xs">
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span
            className={cn(
              "inline-flex items-center gap-1 font-medium",
              isPassed ? "text-status-active-foreground" : "text-destructive",
            )}
          >
            {isPassed ? (
              <Check className="size-3.5 shrink-0" aria-hidden />
            ) : (
              <X className="size-3.5 shrink-0" aria-hidden />
            )}
            {isPassed ? t("iot.calibration.review.passed") : t("iot.calibration.review.failed")}
          </span>
          {r2 !== null && (
            <span className="text-muted-foreground">
              {t("iot.calibration.review.r2", { value: r2.toFixed(4) })}
            </span>
          )}
          {nrmse !== null && (
            <span className="text-muted-foreground">
              {t("iot.calibration.review.nrmse", { value: (nrmse * 100).toFixed(2) })}
            </span>
          )}
        </p>
        {hasWorstPoint && (
          <p className="text-muted-foreground">
            {t("iot.calibration.review.worstPoint", {
              stimulus: String(worstStimulus),
              percent: (worstFraction * 100).toFixed(2),
            })}
          </p>
        )}
        {reasons.length > 0 && (
          <ul className="text-destructive list-disc space-y-0.5 pl-4">
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium">{name}</p>
        <StatusBadge tone={BLOCK_STATUS_TONE[block.status]}>
          {t(`iot.calibration.block.${block.status}`)}
        </StatusBadge>
      </div>
      {block.reason !== undefined && (
        <p className="text-muted-foreground text-sm">{block.reason}</p>
      )}
      {block.coefficients !== undefined && (
        <dl className="space-y-3">{Object.entries(block.coefficients).map(renderCoefficient)}</dl>
      )}
      {/* The evidence beside the claim: a block's own points and line, not one chart for
          the whole run picked by convention. */}
      <CalibrationBlockChart block={block} />
      {renderQuality()}
    </div>
  );
}
