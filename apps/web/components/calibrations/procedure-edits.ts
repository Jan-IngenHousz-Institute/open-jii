/**
 * Edits on a capture procedure: one document in, one document out.
 *
 * A role is a name three other places point at, so renaming one in the rig alone would
 * leave the steps naming an instrument that no longer exists. The editors hold no
 * knowledge of that; they call these.
 */
import type {
  CaptureProcedure,
  ProcedureRead,
  ProcedureStep,
  RigInstrument,
  Stimulus,
} from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import { DUT_ROLE } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";

import { uniqueName } from "./output-schema-edits";

/** A procedure runs its capture phase, and its verify phase after the write. */
export type ProcedurePhase = "steps" | "verify";

export type StepKind = ProcedureStep["kind"];

export const STEP_KINDS: StepKind[] = ["operator", "settle", "set", "read", "sweep"];

export function phaseSteps(procedure: CaptureProcedure, phase: ProcedurePhase): ProcedureStep[] {
  return (phase === "steps" ? procedure.steps : procedure.verify) ?? [];
}

/** An empty verify phase is not a phase; the contract refuses one. */
function withPhase(
  procedure: CaptureProcedure,
  phase: ProcedurePhase,
  steps: ProcedureStep[],
): CaptureProcedure {
  if (phase === "steps") {
    return { ...procedure, steps };
  }

  const { verify: _dropped, ...rest } = procedure;

  return steps.length === 0 ? rest : { ...rest, verify: steps };
}

export function addStep(
  procedure: CaptureProcedure,
  phase: ProcedurePhase,
  step: ProcedureStep,
): CaptureProcedure {
  return withPhase(procedure, phase, [...phaseSteps(procedure, phase), step]);
}

/** A step goes where the author asked for it, not at the end. */
export function insertStep(
  procedure: CaptureProcedure,
  phase: ProcedurePhase,
  index: number,
  step: ProcedureStep,
): CaptureProcedure {
  const steps = [...phaseSteps(procedure, phase)];
  steps.splice(index, 0, step);

  return withPhase(procedure, phase, steps);
}

export function replaceStep(
  procedure: CaptureProcedure,
  phase: ProcedurePhase,
  index: number,
  step: ProcedureStep,
): CaptureProcedure {
  const steps = phaseSteps(procedure, phase).map((current, at) => (at === index ? step : current));

  return withPhase(procedure, phase, steps);
}

export function removeStep(
  procedure: CaptureProcedure,
  phase: ProcedurePhase,
  index: number,
): CaptureProcedure {
  const steps = phaseSteps(procedure, phase).filter((_step, at) => at !== index);

  return withPhase(procedure, phase, steps);
}

/** Order is the running order, so a step that moves past the end of the phase does not. */
export function moveStep(
  procedure: CaptureProcedure,
  phase: ProcedurePhase,
  index: number,
  to: number,
): CaptureProcedure {
  const steps = [...phaseSteps(procedure, phase)];
  const moved = steps.splice(index, 1).at(0);
  if (moved === undefined || to < 0 || to >= steps.length + 1) {
    return procedure;
  }
  steps.splice(to, 0, moved);

  return withPhase(procedure, phase, steps);
}

/** Series name each phase already holds, so a new step cannot take one twice. */
export function takenSeries(procedure: CaptureProcedure, phase: ProcedurePhase): string[] {
  return phaseSteps(procedure, phase).flatMap((step) =>
    step.kind === "read" || step.kind === "sweep" ? [step.series] : [],
  );
}

/**
 * A step of the given kind that the contract already accepts, so adding one never leaves
 * the document unsaveable. What it does is a placeholder; what it is, is valid.
 */
export function newStep(
  kind: StepKind,
  taken: string[],
  read: ProcedureRead = { instrument: DUT_ROLE, command: "hello", as: "reply" },
): ProcedureStep {
  switch (kind) {
    case "operator":
      return { kind, prompt: "Tell the operator what to do here." };
    case "settle":
      return { kind, ms: 1000 };
    case "set":
      return { kind, instrument: DUT_ROLE, set: "setpoint", value: 0 };
    case "read":
      return { kind, series: uniqueName("reading", taken), read: [read] };
    case "sweep":
      return {
        kind,
        series: uniqueName("sweep", taken),
        stimulus: {
          operator: "Set up {value}, then wait for the reading to settle.",
          values: [1, 2],
        },
        read: [read],
      };
  }
}

/** The reads a step takes at each point; only read and sweep steps have any. */
export function stepReads(step: ProcedureStep): ProcedureRead[] {
  return step.kind === "read" || step.kind === "sweep" ? step.read : [];
}

export function replaceRead(
  step: ProcedureStep,
  index: number,
  read: ProcedureRead,
): ProcedureStep {
  if (step.kind !== "read" && step.kind !== "sweep") {
    return step;
  }

  return { ...step, read: step.read.map((current, at) => (at === index ? read : current)) };
}

export function addRead(step: ProcedureStep, read: ProcedureRead): ProcedureStep {
  if (step.kind !== "read" && step.kind !== "sweep") {
    return step;
  }

  return { ...step, read: [...step.read, read] };
}

/** A step with no reads produces nothing, so the last one stays. */
export function removeRead(step: ProcedureStep, index: number): ProcedureStep {
  if ((step.kind !== "read" && step.kind !== "sweep") || step.read.length === 1) {
    return step;
  }

  return { ...step, read: step.read.filter((_read, at) => at !== index) };
}

/** A role becomes a payload key and a python dict key; the contract's own rule for both. */
export const ROLE_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

/** Everything in the rig but the device under test, which declares no handshake of its own. */
export type AuxiliaryInstrument = Extract<RigInstrument, { handshake: string }>;

export function isAuxiliaryInstrument(
  instrument: RigInstrument,
): instrument is AuxiliaryInstrument {
  return "handshake" in instrument;
}

/** How many steps name each role, across both phases. */
export function instrumentRoleUsage(procedure: CaptureProcedure): Partial<Record<string, number>> {
  const usage: Partial<Record<string, number>> = {};

  for (const step of [...procedure.steps, ...(procedure.verify ?? [])]) {
    for (const role of new Set(rolesNamedBy(step))) {
      usage[role] = (usage[role] ?? 0) + 1;
    }
  }

  return usage;
}

export function renameInstrumentRole(
  procedure: CaptureProcedure,
  from: string,
  to: string,
): CaptureProcedure {
  const renameIn = (steps: ProcedureStep[]) => steps.map((step) => renameInStep(step, from, to));

  return {
    ...procedure,
    instruments: procedure.instruments.map((instrument) =>
      // The device under test answers to one name only, so a rename is never its own.
      isAuxiliaryInstrument(instrument) && instrument.role === from
        ? { ...instrument, role: to }
        : instrument,
    ),
    steps: renameIn(procedure.steps),
    ...(procedure.verify === undefined ? {} : { verify: renameIn(procedure.verify) }),
  };
}

export function replaceInstrument(
  procedure: CaptureProcedure,
  role: string,
  next: RigInstrument,
): CaptureProcedure {
  return {
    ...procedure,
    instruments: procedure.instruments.map((instrument) =>
      instrument.role === role ? next : instrument,
    ),
  };
}

export function addInstrument(
  procedure: CaptureProcedure,
  instrument: RigInstrument,
): CaptureProcedure {
  return { ...procedure, instruments: [...procedure.instruments, instrument] };
}

/** The caller decides whether a role the steps still name may go; this only removes it. */
export function removeInstrument(procedure: CaptureProcedure, role: string): CaptureProcedure {
  return {
    ...procedure,
    instruments: procedure.instruments.filter((instrument) => instrument.role !== role),
  };
}

/** A role name derived from a model, numbered until nothing else holds it. */
export function uniqueRole(base: string, taken: string[]): string {
  const stem = base.replace(/[^a-z0-9_]+/g, "_").replace(/^[^a-z]+/, "");

  return uniqueName(stem === "" ? "instrument" : stem, taken);
}

function rolesNamedBy(step: ProcedureStep): string[] {
  switch (step.kind) {
    case "set":
      return [step.instrument];
    case "read":
      return readRoles(step.read);
    case "sweep":
      return [...stimulusRoles(step.stimulus), ...readRoles(step.read)];
    default:
      return [];
  }
}

function readRoles(reads: ProcedureRead[]): string[] {
  return reads.flatMap((read) => ("instrument" in read ? [read.instrument] : []));
}

function stimulusRoles(stimulus: Stimulus): string[] {
  return "instrument" in stimulus ? [stimulus.instrument] : [];
}

function renameInStep(step: ProcedureStep, from: string, to: string): ProcedureStep {
  const renamed = (role: string) => (role === from ? to : role);
  const renameReads = (reads: ProcedureRead[]) =>
    reads.map((read) =>
      "instrument" in read ? { ...read, instrument: renamed(read.instrument) } : read,
    );

  switch (step.kind) {
    case "set":
      return { ...step, instrument: renamed(step.instrument) };
    case "read":
      return { ...step, read: renameReads(step.read) };
    case "sweep":
      return {
        ...step,
        stimulus:
          "instrument" in step.stimulus
            ? { ...step.stimulus, instrument: renamed(step.stimulus.instrument) }
            : step.stimulus,
        read: renameReads(step.read),
      };
    default:
      return step;
  }
}
