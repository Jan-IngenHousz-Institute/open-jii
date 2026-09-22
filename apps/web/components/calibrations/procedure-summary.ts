/** How much bench time a phase asks for, and how much of it the operator must be there. Declared, never estimated. */
import { formatDurationShort } from "@/components/iot-devices/monitoring/format-duration";

import type {
  CaptureProcedure,
  ProcedureRead,
  ProcedureStep,
} from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";

import type { ProcedurePhase } from "./procedure-edits";
import { phaseSteps } from "./procedure-edits";

export interface PhaseSummary {
  steps: number;
  /** Readings the bench takes, a sweep counting one per setpoint. */
  points: number;
  /** Milliseconds the procedure waits on itself; what the operator takes is theirs. */
  waitMs: number;
  /** Steps that stop for a person, whether to do something or to read something off. */
  stops: number;
}

/** A repeat waits between samples, not before the first, as the interpreter runs it. */
function sampleWaitMs(read: ProcedureRead): number {
  if (!("instrument" in read)) {
    return 0;
  }
  return ((read.repeat ?? 1) - 1) * (read.intervalMs ?? 0);
}

function isOperatorRead(read: ProcedureRead): boolean {
  return !("instrument" in read);
}

function stepWaitMs(step: ProcedureStep): number {
  switch (step.kind) {
    case "settle":
      return step.ms;
    case "read":
      return step.read.reduce((total, read) => total + sampleWaitMs(read), 0);
    case "sweep": {
      const perPoint =
        (step.settleMs ?? 0) + step.read.reduce((total, read) => total + sampleWaitMs(read), 0);
      return step.stimulus.values.length * perPoint;
    }
    default:
      return 0;
  }
}

function stepPoints(step: ProcedureStep): number {
  if (step.kind === "read") {
    return 1;
  }
  return step.kind === "sweep" ? step.stimulus.values.length : 0;
}

/** A step stops for a person when it prompts, or when a person supplies the reading. */
function stepStops(step: ProcedureStep): number {
  if (step.kind === "operator") {
    return 1;
  }
  if (step.kind === "read") {
    return step.prompt !== undefined || step.read.some(isOperatorRead) ? 1 : 0;
  }
  if (step.kind === "sweep") {
    return !("instrument" in step.stimulus) || step.read.some(isOperatorRead) ? 1 : 0;
  }
  return 0;
}

/** The phase in one line, beside its heading: what it does, and what it costs to do it. */
export function describePhase(
  summary: PhaseSummary,
  t: (key: string, values?: Record<string, unknown>) => string,
): string {
  const parts = [t("iot.calibration.stage.stepCount", { count: summary.steps })];

  if (summary.points > 0) {
    parts.push(t("iot.calibration.stage.pointCount", { count: summary.points }));
  }
  if (summary.waitMs > 0) {
    parts.push(
      t("iot.calibration.stage.waiting", {
        duration: formatDurationShort(summary.waitMs / 1000),
      }),
    );
  }

  return parts.join(" · ");
}

export function phaseSummary(procedure: CaptureProcedure, phase: ProcedurePhase): PhaseSummary {
  const steps = phaseSteps(procedure, phase);

  return {
    steps: steps.length,
    points: steps.reduce((total, step) => total + stepPoints(step), 0),
    waitMs: steps.reduce((total, step) => total + stepWaitMs(step), 0),
    stops: steps.reduce((total, step) => total + stepStops(step), 0),
  };
}
