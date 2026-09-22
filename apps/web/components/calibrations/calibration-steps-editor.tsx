"use client";

import type {
  CaptureProcedure,
  ProcedureStep,
} from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import type { CalibrationFamily } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";

import { CalibrationAddStep } from "./calibration-add-step";
import { CalibrationStepCell } from "./calibration-step-cell";
import type { ProcedurePhase, StepKind } from "./procedure-edits";
import {
  addStep,
  insertStep,
  moveStep,
  newStep,
  phaseSteps,
  removeStep,
  replaceStep,
  takenSeries,
} from "./procedure-edits";
import { defaultRead } from "./read-columns";
import { readSources, setpointTargets } from "./rig-sources";

interface CalibrationStepsEditorProps {
  procedure: CaptureProcedure;
  phase: ProcedurePhase;
  family: CalibrationFamily;
  canEdit: boolean;
  onChange: (procedure: CaptureProcedure) => void;
}

/** Every name a step can hold comes from the rig above it; a typed one stalls at the bench. */
export function CalibrationStepsEditor({
  procedure,
  phase,
  family,
  canEdit,
  onChange,
}: CalibrationStepsEditorProps) {
  const { t } = useTranslation("iot");

  const steps = phaseSteps(procedure, phase);
  const sources = readSources(procedure, family);
  const targets = setpointTargets(procedure, family);
  const series = takenSeries(procedure, phase);

  // A set step needs something to drive; a sweep can always ask the operator instead.
  const unavailable =
    targets.length === 0 ? { set: t("iot.calibration.procedure.nothingToDrive") } : {};

  function buildStep(kind: StepKind): ProcedureStep {
    const step = newStep(kind, series, defaultRead(sources, []));
    const target = targets.at(0);
    if (target === undefined) {
      return step;
    }

    // A step that drives something opens on a role that has setpoints, rather than on one
    // that has none. For a sweep that is also what puts its range and its ramp on screen.
    const setpoint = target.setpoints.at(0);
    if (step.kind === "set") {
      return { ...step, instrument: target.role, set: setpoint?.name ?? step.set };
    }
    if (step.kind === "sweep") {
      return {
        ...step,
        stimulus: {
          instrument: target.role,
          set: setpoint?.name ?? "",
          values: step.stimulus.values.flatMap((point) =>
            typeof point === "number" ? [point] : [],
          ),
        },
      };
    }

    return step;
  }

  function renderCell(step: ProcedureStep, index: number) {
    return (
      // Positional, so editing a step does not remount it mid-keystroke.
      <div key={index}>
        <CalibrationStepCell
          step={step}
          index={index}
          count={steps.length}
          sources={sources}
          targets={targets}
          takenSeries={series}
          canEdit={canEdit}
          onChange={(next) => onChange(replaceStep(procedure, phase, index, next))}
          onMove={(to) => onChange(moveStep(procedure, phase, index, to))}
          onRemove={() => onChange(removeStep(procedure, phase, index))}
        />
        {canEdit && (
          <CalibrationAddStep
            unavailable={unavailable}
            onAdd={(kind) => onChange(insertStep(procedure, phase, index + 1, buildStep(kind)))}
          />
        )}
      </div>
    );
  }

  if (steps.length === 0) {
    return canEdit ? (
      <CalibrationAddStep
        variant="bottom"
        unavailable={unavailable}
        onAdd={(kind) => onChange(addStep(procedure, phase, buildStep(kind)))}
      />
    ) : (
      <p className="text-muted-foreground text-sm">{t("iot.calibration.procedure.emptyPhase")}</p>
    );
  }

  return (
    <div className="space-y-1">
      {canEdit && (
        <CalibrationAddStep
          unavailable={unavailable}
          onAdd={(kind) => onChange(insertStep(procedure, phase, 0, buildStep(kind)))}
        />
      )}
      {steps.map(renderCell)}
    </div>
  );
}
