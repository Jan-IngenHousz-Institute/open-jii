"use client";

import { useId, useState } from "react";

import { RETAKEN_SERIES_SUFFIX } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import { useTranslation } from "@repo/i18n";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";

import { ROLE_PATTERN } from "./procedure-edits";

interface CalibrationSeriesFieldProps {
  series: string;
  /** Every series this phase produces, this one included, so a rename cannot collide. */
  taken: string[];
  canEdit: boolean;
  onChange: (series: string) => void;
}

/**
 * What a step's readings are called when the script receives them.
 *
 * One name per phase, and never one ending in the retaken suffix: readings an operator
 * took again are kept under that, and a series named the same way would absorb another
 * step's discarded attempts and feed them to the fit as real data.
 */
export function CalibrationSeriesField({
  series,
  taken,
  canEdit,
  onChange,
}: CalibrationSeriesFieldProps) {
  const { t } = useTranslation("iot");
  const fieldId = useId();

  const [draft, setDraft] = useState(series);
  const [committed, setCommitted] = useState(series);

  if (series !== committed) {
    setCommitted(series);
    setDraft(series);
  }

  const isTaken = draft !== series && taken.includes(draft);
  const isReserved = draft.endsWith(RETAKEN_SERIES_SUFFIX);
  const isMalformed = !ROLE_PATTERN.test(draft);
  const error = isTaken
    ? t("iot.calibration.procedure.seriesTaken")
    : isReserved
      ? t("iot.calibration.procedure.seriesReserved")
      : isMalformed
        ? t("iot.calibration.procedure.nameInvalid")
        : null;

  function handleChange(value: string) {
    setDraft(value);
    if (
      value !== series &&
      ROLE_PATTERN.test(value) &&
      !value.endsWith(RETAKEN_SERIES_SUFFIX) &&
      !taken.includes(value)
    ) {
      onChange(value);
    }
  }

  return (
    <div className="min-w-40 flex-1 space-y-1">
      <Label htmlFor={fieldId} className="text-xs">
        {t("iot.calibration.procedure.series")}
      </Label>
      <Input
        id={fieldId}
        value={draft}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={() => setDraft(series)}
        disabled={!canEdit}
        aria-invalid={error !== null}
        className="font-mono"
      />
      {error !== null && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
