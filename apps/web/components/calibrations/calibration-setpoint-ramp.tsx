"use client";

import { useState } from "react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

import { CalibrationNumberField } from "./calibration-number-field";
import type { SetpointOption } from "./rig-sources";
import { setpointRamp } from "./setpoint-ramp";

interface CalibrationSetpointRampProps {
  /** The setpoint being driven, whose range the ramp opens on. */
  setpoint: SetpointOption | undefined;
  canEdit: boolean;
  onFill: (values: number[]) => void;
}

const DEFAULT_POINTS = 6;

/** A ramp across the setpoint's range, in place of typing each point out. */
export function CalibrationSetpointRamp({
  setpoint,
  canEdit,
  onFill,
}: CalibrationSetpointRampProps) {
  const { t } = useTranslation("iot");

  const [from, setFrom] = useState<number | undefined>(setpoint?.min ?? 0);
  const [to, setTo] = useState<number | undefined>(setpoint?.max);
  const [points, setPoints] = useState<number | undefined>(DEFAULT_POINTS);

  const ramp =
    from === undefined || to === undefined || points === undefined
      ? []
      : setpointRamp(from, to, points);

  return (
    <div className="bg-muted/50 flex flex-wrap items-end gap-3 rounded-lg p-3">
      <CalibrationNumberField
        label={t("iot.calibration.procedure.rampFrom")}
        value={from}
        onCommit={setFrom}
        canEdit={canEdit}
        className="min-w-24 space-y-1"
      />
      <CalibrationNumberField
        label={t("iot.calibration.procedure.rampTo")}
        value={to}
        onCommit={setTo}
        canEdit={canEdit}
        className="min-w-24 space-y-1"
      />
      <CalibrationNumberField
        label={t("iot.calibration.procedure.rampPoints")}
        value={points}
        onCommit={setPoints}
        canEdit={canEdit}
        min={2}
        max={64}
        integer
        className="min-w-20 space-y-1"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!canEdit || ramp.length === 0}
        onClick={() => onFill(ramp)}
      >
        {t("iot.calibration.procedure.rampFill")}
      </Button>
      {setpoint !== undefined && (
        <p className="text-muted-foreground w-full text-xs">
          {t("iot.calibration.procedure.rampRange", {
            min: setpoint.min,
            max: setpoint.max,
            unit: setpoint.unit,
          })}
        </p>
      )}
    </div>
  );
}
