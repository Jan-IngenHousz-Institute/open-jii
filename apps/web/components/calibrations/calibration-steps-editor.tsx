"use client";

import { Plus } from "lucide-react";

import type {
  CaptureProcedure,
  ProcedureStep,
} from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import { DUT_ROLE } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import type { CalibrationFamily } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";

import { CalibrationStepCard } from "./calibration-step-card";
import type { ProcedurePhase, StepKind } from "./procedure-edits";
import {
  STEP_KINDS,
  addStep,
  moveStep,
  newStep,
  phaseSteps,
  removeStep,
  replaceStep,
  takenSeries,
} from "./procedure-edits";
import { readSources, setpointTargets } from "./rig-sources";

/** Every family's driver answers this, and a rig always declares the device. */
const FALLBACK_COMMAND = "hello";

interface CalibrationStepsEditorProps {
  procedure: CaptureProcedure;
  phase: ProcedurePhase;
  family: CalibrationFamily;
  canEdit: boolean;
  onChange: (procedure: CaptureProcedure) => void;
}

/**
 * One phase of a procedure, as the bench will run it.
 *
 * Every name a step can hold comes from the rig above it: the instruments it declared,
 * the setpoints those can be driven through, the readings they answer. Typing one is how
 * a procedure passes review and then stalls at the bench.
 */
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

  // A set step needs something to drive, and a sweep can always ask the operator.
  const isAvailable = (kind: StepKind) => kind !== "set" || targets.length > 0;

  function handleAdd(kind: StepKind) {
    const source = sources.at(0);
    const read = {
      instrument: source?.role ?? DUT_ROLE,
      command: source?.offered.at(0) ?? FALLBACK_COMMAND,
      as: "value",
    };
    const step = newStep(kind, series, read);

    onChange(addStep(procedure, phase, targets.length > 0 ? withFirstTarget(step) : step));
  }

  /** A set step opens on a role that has setpoints, rather than one that has none. */
  function withFirstTarget(step: ProcedureStep): ProcedureStep {
    const target = targets.at(0);
    if (step.kind !== "set" || target === undefined) {
      return step;
    }

    return { ...step, instrument: target.role, set: target.setpoints.at(0)?.name ?? step.set };
  }

  function renderKindOption(kind: StepKind) {
    return (
      <DropdownMenuItem key={kind} disabled={!isAvailable(kind)} onSelect={() => handleAdd(kind)}>
        <span className="font-mono text-xs uppercase">{kind}</span>
        <span className="text-muted-foreground ml-2 text-xs">
          {t(`iot.calibration.procedure.kind.${kind}`)}
        </span>
      </DropdownMenuItem>
    );
  }

  function renderStep(step: ProcedureStep, index: number) {
    return (
      <CalibrationStepCard
        // Positional, so editing a step does not remount it mid-keystroke.
        key={index}
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
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">
        {t(`iot.calibration.procedure.${phase === "steps" ? "captureHint" : "verifyHint"}`)}
      </p>

      <ul className="space-y-2">{steps.map(renderStep)}</ul>

      {canEdit && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <Plus className="mr-2 size-4" aria-hidden />
              {t("iot.calibration.procedure.addStep")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {STEP_KINDS.map(renderKindOption)}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
