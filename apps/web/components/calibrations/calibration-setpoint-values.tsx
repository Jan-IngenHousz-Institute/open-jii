"use client";

import { useId, useState } from "react";

import type { Stimulus } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import { useTranslation } from "@repo/i18n";
import { Label } from "@repo/ui/components/label";
import { Textarea } from "@repo/ui/components/textarea";

type SetpointValue = Extract<Stimulus, { operator: string }>["values"][number];

interface CalibrationSetpointValuesProps {
  values: SetpointValue[];
  /** An instrument takes numbers; labels and compound setpoints are for the operator. */
  numbersOnly: boolean;
  canEdit: boolean;
  onChange: (values: SetpointValue[]) => void;
}

function toText(values: SetpointValue[]): string {
  return values
    .map((value) => (typeof value === "object" ? JSON.stringify(value) : String(value)))
    .join("\n");
}

/** A line is a number where it can be one, a JSON object where it starts like one, else text. */
function parseLine(line: string, numbersOnly: boolean): SetpointValue | undefined {
  const trimmed = line.trim();
  if (trimmed === "") {
    return undefined;
  }

  const asNumber = Number(trimmed);
  if (Number.isFinite(asNumber)) {
    return asNumber;
  }
  if (numbersOnly) {
    return undefined;
  }
  if (!trimmed.startsWith("{")) {
    return trimmed;
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? Object.fromEntries(
          Object.entries(parsed).flatMap(([key, entry]) =>
            typeof entry === "number" || typeof entry === "string" ? [[key, entry]] : [],
          ),
        )
      : undefined;
  } catch {
    return undefined;
  }
}

export function CalibrationSetpointValues({
  values,
  numbersOnly,
  canEdit,
  onChange,
}: CalibrationSetpointValuesProps) {
  const { t } = useTranslation("iot");
  const fieldId = useId();

  const committed = toText(values);
  const [draft, setDraft] = useState<string>();
  const [lastCommitted, setLastCommitted] = useState(committed);

  // Switching a sweep between an instrument and the operator rewrites its values.
  if (committed !== lastCommitted) {
    setLastCommitted(committed);
    setDraft(undefined);
  }

  function handleChange(text: string) {
    setDraft(text);

    const lines = text.split("\n").filter((line) => line.trim() !== "");
    const parsed = lines.flatMap((line) => {
      const value = parseLine(line, numbersOnly);
      return value === undefined ? [] : [value];
    });

    // A point that is not a point yet would be dropped silently on save.
    if (parsed.length === lines.length && parsed.length > 0 && parsed.length <= 64) {
      onChange(parsed);
    }
  }

  return (
    <div className="space-y-1">
      <Label htmlFor={fieldId} className="text-xs">
        {t("iot.calibration.procedure.values")}
      </Label>
      <Textarea
        id={fieldId}
        value={draft ?? committed}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={() => setDraft(undefined)}
        disabled={!canEdit}
        rows={Math.min(Math.max(values.length, 2), 8)}
        className="font-mono text-sm"
      />
      <p className="text-muted-foreground text-xs">
        {numbersOnly
          ? t("iot.calibration.procedure.valuesNumericHint")
          : t("iot.calibration.procedure.valuesHint")}
      </p>
    </div>
  );
}
