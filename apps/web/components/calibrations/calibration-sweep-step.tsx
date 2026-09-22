"use client";

import { useId } from "react";

import type {
  ProcedureStep,
  Stimulus,
} from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import { useTranslation } from "@repo/i18n";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import { CalibrationNumberField } from "./calibration-number-field";
import { CalibrationReadList } from "./calibration-read-list";
import { CalibrationSeriesField } from "./calibration-series-field";
import { CalibrationSetpointRamp } from "./calibration-setpoint-ramp";
import { CalibrationSetpointShape } from "./calibration-setpoint-shape";
import { CalibrationSetpointValues } from "./calibration-setpoint-values";
import type { ReadSource, SetpointTarget } from "./rig-sources";

type SweepStep = Extract<ProcedureStep, { kind: "sweep" }>;
type SetpointValue = Extract<Stimulus, { operator: string }>["values"][number];

/** Stands for the operator setting each point up by hand. */
const OPERATOR_STIMULUS = "operator";

interface CalibrationSweepStepProps {
  step: SweepStep;
  sources: ReadSource[];
  targets: SetpointTarget[];
  takenSeries: string[];
  canEdit: boolean;
  onChange: (step: ProcedureStep) => void;
}

/** The stimulus is an instrument the platform drives or the operator by hand, and a bench often needs both. */
export function CalibrationSweepStep({
  step,
  sources,
  targets,
  takenSeries,
  canEdit,
  onChange,
}: CalibrationSweepStepProps) {
  const { t } = useTranslation("iot");
  const stimulusId = useId();
  const setpointId = useId();
  const promptId = useId();

  const stimulus = step.stimulus;
  const isDrivenByInstrument = "instrument" in stimulus;
  const target = isDrivenByInstrument
    ? targets.find((candidate) => candidate.role === stimulus.instrument)
    : undefined;
  const setpoint = isDrivenByInstrument
    ? target?.setpoints.find((candidate) => candidate.name === stimulus.set)
    : undefined;
  // An operator sweep may step through labels or compound setpoints, which have no shape.
  const numericValues = stimulus.values.flatMap((value) =>
    typeof value === "number" ? [value] : [],
  );

  function handleDrivenChange(value: string) {
    if (value === OPERATOR_STIMULUS) {
      onChange({
        ...step,
        stimulus: {
          operator: t("iot.calibration.procedure.operatorStimulusPrompt"),
          values: stimulus.values,
        },
      });
      return;
    }

    const picked = targets.find((candidate) => candidate.role === value);
    const first = picked?.setpoints.at(0);
    // An instrument takes numbers, so labels an operator was reading do not survive.
    onChange({
      ...step,
      stimulus: {
        instrument: value,
        set: first?.name ?? "",
        values: stimulus.values.flatMap((point) => (typeof point === "number" ? [point] : [])),
      },
    });
  }

  function handleSetpointChange(set: string) {
    if ("instrument" in stimulus) {
      onChange({ ...step, stimulus: { ...stimulus, set } });
    }
  }

  function handlePromptChange(operator: string) {
    if ("operator" in stimulus) {
      onChange({ ...step, stimulus: { ...stimulus, operator } });
    }
  }

  function handleValuesChange(values: SetpointValue[]) {
    if ("instrument" in stimulus) {
      onChange({
        ...step,
        stimulus: {
          ...stimulus,
          values: values.flatMap((point) => (typeof point === "number" ? [point] : [])),
        },
      });
      return;
    }

    onChange({ ...step, stimulus: { ...stimulus, values } });
  }

  function renderTargetOption(candidate: SetpointTarget) {
    return (
      <SelectItem key={candidate.role} value={candidate.role} className="font-mono">
        {candidate.role}
      </SelectItem>
    );
  }

  function renderSetpointOption(name: string) {
    return (
      <SelectItem key={name} value={name} className="font-mono">
        {name}
      </SelectItem>
    );
  }

  function renderStimulusFields() {
    if (!isDrivenByInstrument) {
      return (
        <div className="min-w-48 flex-1 space-y-1">
          <Label htmlFor={promptId} className="text-xs">
            {t("iot.calibration.procedure.operatorPrompt")}
          </Label>
          <Input
            id={promptId}
            value={stimulus.operator}
            onChange={(event) => handlePromptChange(event.target.value)}
            disabled={!canEdit}
            aria-invalid={stimulus.operator.trim() === ""}
          />
          <p className="text-muted-foreground text-xs">
            {t("iot.calibration.procedure.placeholderHint")}
          </p>
        </div>
      );
    }

    // The range rides with the label: a hint under one field of a row pushes its
    // neighbours' labels out of line.
    return (
      <div className="min-w-40 flex-1 space-y-1">
        <div className="flex items-baseline gap-2">
          <Label htmlFor={setpointId} className="text-xs">
            {t("iot.calibration.procedure.setpoint")}
          </Label>
          {setpoint !== undefined && (
            <span className="text-muted-foreground font-mono text-[11px]">
              {`${String(setpoint.min)}…${String(setpoint.max)} ${setpoint.unit}`}
            </span>
          )}
        </div>
        <Select
          value={stimulus.set}
          onValueChange={handleSetpointChange}
          disabled={!canEdit || target === undefined}
        >
          <SelectTrigger id={setpointId} className="font-mono">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(target?.setpoints ?? []).map((candidate) => renderSetpointOption(candidate.name))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Top aligned: every field here is labelled, and one carries a hint under it. */}
      <div className="flex flex-wrap items-start gap-3">
        <CalibrationSeriesField
          series={step.series}
          taken={takenSeries}
          canEdit={canEdit}
          onChange={(series) => onChange({ ...step, series })}
        />

        <div className="min-w-32 space-y-1">
          <Label htmlFor={stimulusId} className="text-xs">
            {t("iot.calibration.procedure.driven")}
          </Label>
          <Select
            value={isDrivenByInstrument ? stimulus.instrument : OPERATOR_STIMULUS}
            onValueChange={handleDrivenChange}
            disabled={!canEdit}
          >
            <SelectTrigger id={stimulusId} className="font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {targets.map(renderTargetOption)}
              <SelectItem value={OPERATOR_STIMULUS}>
                {t("iot.calibration.procedure.operatorSource")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {renderStimulusFields()}

        <CalibrationNumberField
          label={t("iot.calibration.procedure.settleAfter")}
          value={step.settleMs}
          onCommit={(settleMs) => onChange({ ...step, settleMs })}
          canEdit={canEdit}
          min={0}
          max={600_000}
          integer
          clearable
          className="min-w-24 space-y-1"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <CalibrationSetpointValues
          values={stimulus.values}
          numbersOnly={isDrivenByInstrument}
          canEdit={canEdit}
          onChange={handleValuesChange}
        />
        <CalibrationSetpointShape values={numericValues} unit={setpoint?.unit} />
      </div>

      {/* Only an instrument sweeps a range of numbers; what an operator sets up is named. */}
      {isDrivenByInstrument && canEdit && (
        <CalibrationSetpointRamp
          setpoint={setpoint}
          canEdit={canEdit}
          onFill={handleValuesChange}
        />
      )}

      <CalibrationReadList step={step} sources={sources} canEdit={canEdit} onChange={onChange} />
    </div>
  );
}
