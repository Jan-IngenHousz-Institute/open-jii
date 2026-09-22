"use client";

import { useTranslation } from "@repo/i18n";

import type { SetpointOption } from "./rig-sources";

interface CalibrationRigChipProps {
  role: string;
  /** The model behind the role, or what stands in for one when none is named. */
  model: string;
  setpoints: SetpointOption[];
  readings: string[];
  /** Shown when the role drives nothing, where that is a fact rather than an omission. */
  noSetpoints?: string;
}

/** Phrasing content throughout, because the strip puts it inside a button. */
export function CalibrationRigChip({
  role,
  model,
  setpoints,
  readings,
  noSetpoints,
}: CalibrationRigChipProps) {
  const { t } = useTranslation("iot");

  const drives = setpoints.map((setpoint) =>
    t("iot.calibration.rig.setpointRange", {
      name: setpoint.name,
      min: setpoint.min,
      max: setpoint.max,
      unit: setpoint.unit,
    }),
  );

  // A role that drives nothing says so only where that is worth saying, which is the
  // device: a reference sensor never drives anything and does not need a line about it.
  const driven = drives.length === 0 && noSetpoints !== undefined ? [noSetpoints] : drives;

  // Each entry holds together: a range broken across a line leaves its unit stranded.
  function renderLine(label: string, values: string[]) {
    return (
      <>
        <span className="text-muted-foreground text-[11px]">{label}</span>
        <span className="text-muted-foreground font-mono text-[11px]">
          {values.map((value, index) => (
            <span key={value} className="whitespace-nowrap">
              {index > 0 && " · "}
              {value}
            </span>
          ))}
        </span>
      </>
    );
  }

  return (
    <span className="grid min-w-0 grid-cols-[max-content_minmax(0,1fr)] gap-x-2 gap-y-0.5 text-left">
      <span className="col-span-2 flex flex-wrap items-baseline gap-x-2">
        <span className="font-mono text-sm">{role}</span>
        <span className="text-muted-foreground text-[11px]">{model}</span>
      </span>

      {driven.length > 0 && renderLine(t("iot.calibration.rig.drives"), driven)}
      {readings.length > 0 && renderLine(t("iot.calibration.rig.answers"), readings)}
    </span>
  );
}
