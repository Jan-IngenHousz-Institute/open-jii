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

/** A role becomes a payload key and a python dict key; the contract's own rule for both. */
export const ROLE_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

/**
 * Whether the rig is one the contract would take. An author typing a role is briefly
 * between two valid names, and saving then would refuse the whole document.
 */
export function isRigComplete(procedure: CaptureProcedure): boolean {
  const roles = procedure.instruments.map((instrument) => instrument.role);

  return (
    new Set(roles).size === roles.length &&
    procedure.instruments
      .filter(isAuxiliaryInstrument)
      .every(
        (instrument) => ROLE_PATTERN.test(instrument.role) && instrument.handshake.trim() !== "",
      )
  );
}

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
  const candidate = stem === "" ? "instrument" : stem;

  if (!taken.includes(candidate)) {
    return candidate;
  }
  for (let suffix = 2; ; suffix++) {
    const numbered = `${candidate}_${String(suffix)}`;
    if (!taken.includes(numbered)) {
      return numbered;
    }
  }
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
