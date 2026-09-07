"use client";

import { StatusBadge } from "@/components/shared/status-badge";
import type { StatusTone } from "@/components/shared/status-badge";
import { ArrowRight } from "lucide-react";

import type {
  CalibrationBlock,
  CalibrationBlockStatus,
} from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";

import { formatCoefficientValue } from "./format-coefficient-value";

const BLOCK_STATUS_TONE: Record<CalibrationBlockStatus, StatusTone> = {
  computed: "published",
  rejected: "destructive",
  skipped: "archived",
};

interface CalibrationBlockCardProps {
  name: string;
  block: CalibrationBlock;
  /** The coefficients currently in force for this block, when known. */
  previous: Record<string, number | number[]> | undefined;
}

/**
 * One coefficient block of a run: what was computed, against what the device
 * holds now, with the quality record that justifies it.
 */
export function CalibrationBlockCard({ name, block, previous }: CalibrationBlockCardProps) {
  const { t } = useTranslation("iot");

  const quality = block.quality;
  const isPassed = quality?.passed === true;
  const reasons = Array.isArray(quality?.reasons) ? quality.reasons.map(String) : [];
  const r2 = typeof quality?.r2 === "number" ? quality.r2 : null;
  const nrmse = typeof quality?.nrmse === "number" ? quality.nrmse : null;

  function renderCoefficient([coefficient, value]: [string, number | number[]]) {
    const before = previous?.[coefficient];
    return (
      <div key={coefficient} className="contents">
        <dt className="text-muted-foreground">{coefficient}</dt>
        <dd className="flex items-center gap-2 font-mono">
          <span className="text-muted-foreground">
            {before === undefined
              ? t("iot.calibration.review.previousUnknown")
              : formatCoefficientValue(before)}
          </span>
          <ArrowRight className="text-muted-foreground size-3" aria-hidden />
          <span>{formatCoefficientValue(value)}</span>
        </dd>
      </div>
    );
  }

  function renderQuality() {
    if (!quality) return null;
    return (
      <div className="space-y-1 text-xs">
        <p className="flex flex-wrap items-center gap-3">
          <span className={isPassed ? "text-status-active-foreground" : "text-destructive"}>
            {isPassed ? t("iot.calibration.review.passed") : t("iot.calibration.review.failed")}
          </span>
          {r2 !== null && <span>{t("iot.calibration.review.r2", { value: r2.toFixed(4) })}</span>}
          {nrmse !== null && (
            <span>{t("iot.calibration.review.nrmse", { value: (nrmse * 100).toFixed(2) })}</span>
          )}
        </p>
        {reasons.length > 0 && (
          <ul className="text-destructive list-disc pl-4">
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">{name}</p>
        <StatusBadge tone={BLOCK_STATUS_TONE[block.status]}>
          {t(`iot.calibration.block.${block.status}`)}
        </StatusBadge>
      </div>
      {block.reason !== undefined && (
        <p className="text-muted-foreground text-sm">{block.reason}</p>
      )}
      {block.coefficients !== undefined && (
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
          {Object.entries(block.coefficients).map(renderCoefficient)}
        </dl>
      )}
      {renderQuality()}
    </div>
  );
}
