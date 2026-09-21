"use client";

import { StatusBadge } from "@/components/shared/status-badge";
import type { StatusTone } from "@/components/shared/status-badge";
import { Check, ChevronDown, X } from "lucide-react";

import type {
  CalibrationBlock,
  CalibrationBlockStatus,
  CalibrationOutputSchema,
} from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/collapsible";
import { cn } from "@repo/ui/lib/utils";

import { CalibrationBlockChart } from "./calibration-block-chart";
import { CalibrationResidualChart } from "./calibration-residual-chart";
import { formatCoefficientValue } from "./format-coefficient-value";
import { residualReport } from "./residual-data";

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
  /** The bounds the definition declared, so a value can be read against what it is allowed. */
  spec?: CalibrationOutputSchema["blocks"][string];
}

/**
 * One block, ranked for the decision it is evidence for.
 *
 * The verdict comes first because it is what a reviewer is deciding about; then the numbers
 * against the bounds they were judged by and what they replace; then the picture; then, for
 * whoever wants it, the residuals the script computed and the thresholds it applied.
 */
export function CalibrationBlockCard({ name, block, previous, spec }: CalibrationBlockCardProps) {
  const { t } = useTranslation("iot");

  const quality = block.quality;
  const isPassed = quality?.passed === true;
  const hasVerdict = typeof quality?.passed === "boolean";
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
  const residuals = residualReport(block);

  /** What a coefficient is allowed to be, beside what it turned out to be. */
  function renderBounds(coefficient: string) {
    const bounds = spec?.[coefficient];
    if (bounds?.min === undefined && bounds?.max === undefined) {
      return null;
    }
    return (
      <dd className="text-muted-foreground text-xs">
        {t("iot.calibration.review.allowed", {
          min: bounds.min ?? "-∞",
          max: bounds.max ?? "∞",
        })}
      </dd>
    );
  }

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
        {renderBounds(coefficient)}
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

  // The verdict is the headline, not a footnote: it is the thing being decided about.
  function renderVerdict() {
    if (!hasVerdict) {
      return null;
    }
    // The verdict on its own line and the figures under it: one wrapping row splits them
    // wherever the card happens to end.
    return (
      <div className="space-y-1">
        <p
          className={cn(
            "flex items-center gap-1.5 text-sm font-medium",
            isPassed ? "text-status-active-foreground" : "text-destructive",
          )}
        >
          {isPassed ? (
            <Check className="size-4 shrink-0" aria-hidden />
          ) : (
            <X className="size-4 shrink-0" aria-hidden />
          )}
          {isPassed ? t("iot.calibration.review.passed") : t("iot.calibration.review.failed")}
        </p>
        {(r2 !== null || nrmse !== null) && (
          <p className="text-muted-foreground pl-5.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs tabular-nums">
            {r2 !== null && <span>{t("iot.calibration.review.r2", { value: r2.toFixed(4) })}</span>}
            {nrmse !== null && (
              <span>{t("iot.calibration.review.nrmse", { value: (nrmse * 100).toFixed(2) })}</span>
            )}
          </p>
        )}
      </div>
    );
  }

  function renderReasons() {
    if (reasons.length === 0) {
      return null;
    }
    return (
      <ul className="text-destructive list-disc space-y-0.5 pl-4 text-xs">
        {reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    );
  }

  // Everything the script computed and the record kept: worth one click, not the front page.
  function renderDiagnostics() {
    if (residuals === null) {
      return null;
    }
    return (
      <Collapsible>
        <CollapsibleTrigger className="text-muted-foreground hover:text-foreground group flex items-center gap-1 text-left text-xs">
          <ChevronDown
            className="size-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-180"
            aria-hidden
          />
          {t("iot.calibration.review.diagnostics")}
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <CalibrationResidualChart report={residuals} />
          {residuals.truncated && (
            <p className="text-muted-foreground text-xs">
              {t("iot.calibration.review.residualsTruncated")}
            </p>
          )}
        </CollapsibleContent>
      </Collapsible>
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
      {renderVerdict()}
      {block.reason !== undefined && (
        <p className="text-muted-foreground text-sm">{block.reason}</p>
      )}
      {renderReasons()}
      {block.coefficients !== undefined && (
        <dl className="space-y-3">{Object.entries(block.coefficients).map(renderCoefficient)}</dl>
      )}
      {/* The evidence beside the claim: a block's own points and line, not one chart for
          the whole run picked by convention. */}
      <CalibrationBlockChart block={block} />
      {hasWorstPoint && (
        <p className="text-muted-foreground text-xs">
          {t("iot.calibration.review.worstPoint", {
            stimulus: String(worstStimulus),
            percent: (worstFraction * 100).toFixed(2),
          })}
        </p>
      )}
      {renderDiagnostics()}
    </div>
  );
}
