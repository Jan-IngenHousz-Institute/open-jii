"use client";

import { useId } from "react";

import type { ProcedureStep } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import { useTranslation } from "@repo/i18n";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";

import { CalibrationReadList } from "./calibration-read-list";
import { CalibrationSeriesField } from "./calibration-series-field";
import type { ReadSource } from "./rig-sources";

type ReadStep = Extract<ProcedureStep, { kind: "read" }>;

interface CalibrationReadStepProps {
  step: ReadStep;
  sources: ReadSource[];
  takenSeries: string[];
  canEdit: boolean;
  onChange: (step: ProcedureStep) => void;
}

/** One set of readings taken at one moment, under one name the script will index by. */
export function CalibrationReadStep({
  step,
  sources,
  takenSeries,
  canEdit,
  onChange,
}: CalibrationReadStepProps) {
  const { t } = useTranslation("iot");
  const promptId = useId();

  function handlePromptChange(value: string) {
    const prompt = value.trim() === "" ? undefined : value;
    onChange({ ...step, prompt });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <CalibrationSeriesField
          series={step.series}
          taken={takenSeries}
          canEdit={canEdit}
          onChange={(series) => onChange({ ...step, series })}
        />

        <div className="min-w-48 flex-1 space-y-1">
          <Label htmlFor={promptId} className="text-xs">
            {t("iot.calibration.procedure.prompt")}
          </Label>
          <Input
            id={promptId}
            value={step.prompt ?? ""}
            onChange={(event) => handlePromptChange(event.target.value)}
            disabled={!canEdit}
            placeholder={t("iot.calibration.procedure.promptPlaceholder")}
          />
        </div>
      </div>

      <CalibrationReadList step={step} sources={sources} canEdit={canEdit} onChange={onChange} />
    </div>
  );
}
