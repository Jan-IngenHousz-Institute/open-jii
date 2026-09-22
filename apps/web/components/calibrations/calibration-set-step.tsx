"use client";

import { useId } from "react";

import type { ProcedureStep } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import { useTranslation } from "@repo/i18n";
import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import { CalibrationNumberField } from "./calibration-number-field";
import type { SetpointOption, SetpointTarget } from "./rig-sources";

type SetStep = Extract<ProcedureStep, { kind: "set" }>;

interface CalibrationSetStepProps {
  step: SetStep;
  targets: SetpointTarget[];
  canEdit: boolean;
  onChange: (step: SetStep) => void;
}

/** Limits come from the instrument: a supply asked for a current it cannot give refuses mid-sweep. */
export function CalibrationSetStep({ step, targets, canEdit, onChange }: CalibrationSetStepProps) {
  const { t } = useTranslation("iot");
  const roleId = useId();
  const setpointId = useId();

  const target = targets.find((candidate) => candidate.role === step.instrument);
  const setpoint = target?.setpoints.find((candidate) => candidate.name === step.set);

  function handleRoleChange(role: string) {
    const picked = targets.find((candidate) => candidate.role === role);
    const first = picked?.setpoints.at(0);
    onChange({ ...step, instrument: role, set: first?.name ?? step.set });
  }

  function renderTargetOption(candidate: SetpointTarget) {
    return (
      <SelectItem key={candidate.role} value={candidate.role} className="font-mono">
        {candidate.role}
      </SelectItem>
    );
  }

  function renderSetpointOption(candidate: SetpointOption) {
    return (
      <SelectItem key={candidate.name} value={candidate.name} className="font-mono">
        {candidate.name}
      </SelectItem>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-32 flex-1 space-y-1">
        <Label htmlFor={roleId} className="text-xs">
          {t("iot.calibration.procedure.instrument")}
        </Label>
        <Select value={step.instrument} onValueChange={handleRoleChange} disabled={!canEdit}>
          <SelectTrigger id={roleId} className="font-mono">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>{targets.map(renderTargetOption)}</SelectContent>
        </Select>
      </div>

      <div className="min-w-40 flex-1 space-y-1">
        <Label htmlFor={setpointId} className="text-xs">
          {t("iot.calibration.procedure.setpoint")}
        </Label>
        <Select
          value={step.set}
          onValueChange={(set) => onChange({ ...step, set })}
          disabled={!canEdit || target === undefined}
        >
          <SelectTrigger id={setpointId} className="font-mono">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>{(target?.setpoints ?? []).map(renderSetpointOption)}</SelectContent>
        </Select>
      </div>

      <CalibrationNumberField
        label={t("iot.calibration.procedure.value")}
        value={step.value}
        onCommit={(value) => onChange({ ...step, value: value ?? step.value })}
        canEdit={canEdit}
        min={setpoint?.min}
        max={setpoint?.max}
        integer={setpoint?.integer}
        hint={
          setpoint === undefined
            ? undefined
            : `${String(setpoint.min)}…${String(setpoint.max)} ${setpoint.unit}`
        }
        className="min-w-32 flex-1 space-y-1"
      />
    </div>
  );
}
