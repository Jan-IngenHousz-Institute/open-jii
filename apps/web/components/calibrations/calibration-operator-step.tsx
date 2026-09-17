"use client";

import { useId } from "react";

import type { ProcedureStep } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import { useTranslation } from "@repo/i18n";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Textarea } from "@repo/ui/components/textarea";

type OperatorStep = Extract<ProcedureStep, { kind: "operator" }>;

interface CalibrationOperatorStepProps {
  step: OperatorStep;
  canEdit: boolean;
  onChange: (step: OperatorStep) => void;
}

/**
 * Something for the person at the bench to do, and optionally a word they must type for
 * the run to go on.
 *
 * The typed word is not ceremony: a dark measurement taken with the lid open is not
 * distinguishable in the data from one taken correctly, and it invalidates the run.
 */
export function CalibrationOperatorStep({ step, canEdit, onChange }: CalibrationOperatorStepProps) {
  const { t } = useTranslation("iot");
  const promptId = useId();
  const confirmId = useId();

  function handleConfirmChange(value: string) {
    const confirm = value.trim() === "" ? undefined : value;
    onChange({ ...step, confirm });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor={promptId} className="text-xs">
          {t("iot.calibration.procedure.prompt")}
        </Label>
        <Textarea
          id={promptId}
          value={step.prompt}
          onChange={(event) => onChange({ ...step, prompt: event.target.value })}
          disabled={!canEdit}
          aria-invalid={step.prompt.trim() === ""}
          rows={2}
        />
      </div>

      <div className="min-w-40 max-w-xs space-y-1">
        <Label htmlFor={confirmId} className="text-xs">
          {t("iot.calibration.procedure.confirm")}
        </Label>
        <Input
          id={confirmId}
          value={step.confirm ?? ""}
          onChange={(event) => handleConfirmChange(event.target.value)}
          disabled={!canEdit}
          placeholder={t("iot.calibration.procedure.confirmPlaceholder")}
          className="font-mono"
        />
        <p className="text-muted-foreground text-xs">
          {t("iot.calibration.procedure.confirmHint")}
        </p>
      </div>
    </div>
  );
}
