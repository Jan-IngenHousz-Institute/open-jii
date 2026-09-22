"use client";

import { CheckCircle2, XCircle } from "lucide-react";

import { useTranslation } from "@repo/i18n";

import type { SessionUnit } from "./session-unit";

interface CalibrationSessionTallyProps {
  units: SessionUnit[];
}

/**
 * What this sitting has got through.
 *
 * An operator with a tray of hardware needs two things the screen would not otherwise
 * answer: how far along they are, and whether the unit in their hand has already had its
 * turn. Both are read at a glance rather than counted off the table.
 */
export function CalibrationSessionTally({ units }: CalibrationSessionTallyProps) {
  const { t } = useTranslation("iot");

  const recorded = units.filter((unit) => unit.outcome === "recorded").length;

  function renderUnit(unit: SessionUnit) {
    const isRecorded = unit.outcome === "recorded";

    return (
      <li key={unit.runId} className="flex items-center gap-2">
        {isRecorded ? (
          <CheckCircle2 className="text-status-active size-3.5 shrink-0" aria-hidden />
        ) : (
          <XCircle className="text-destructive size-3.5 shrink-0" aria-hidden />
        )}
        <span className="min-w-0 flex-1 truncate font-mono text-xs">
          {unit.deviceName ?? unit.serial}
        </span>
        {unit.reason !== undefined && (
          <span className="text-muted-foreground shrink-0 truncate text-xs">{unit.reason}</span>
        )}
      </li>
    );
  }

  return (
    <section className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          {t("iot.calibration.sitting.thisSitting")}
        </p>
        <p className="text-muted-foreground text-xs tabular-nums">
          {t("iot.calibration.sitting.recordedOf", { recorded, total: units.length })}
        </p>
      </div>
      <ul className="space-y-1">{units.map(renderUnit)}</ul>
    </section>
  );
}
