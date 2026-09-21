import { z } from "zod";

// Series, role, and column names become payload keys, python dict keys, and
// DataFrame columns; one shared shape keeps them safe in all three.
const IDENTIFIER_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
const zIdentifier = z
  .string()
  .regex(IDENTIFIER_PATTERN, "Must be a lowercase identifier (a-z, 0-9, _)");

// Reserved column on every sweep series; carries the setpoint value per row.
export const SWEEP_STIMULUS_COLUMN = "stimulus";

// The device under test; its handshake comes from the family driver.
export const DUT_ROLE = "dut";

const zDutInstrument = z
  .object({
    role: z.literal(DUT_ROLE),
  })
  .strict();

// Discovered over serial by its identity handshake, e.g. "KIPRIM".
const zAuxiliaryInstrument = z
  .object({
    role: zIdentifier,
    handshake: z.string().min(1).max(64),
    /**
     * Which bench instrument this role expects, by the model name the driver registry
     * holds. A handshake naming one unit of a model ("Par_REF") says nothing about which
     * model that is, so the setpoints and readings a step may name are only knowable from
     * here. Absent means any instrument whose identity reply carries the handshake.
     */
    model: z.string().min(1).max(64).optional(),
  })
  .strict();

export const zRigInstrument = z.union([zDutInstrument, zAuxiliaryInstrument]);

// An operator prompt may interpolate the setpoint with {value} or {value.key}.
// A sweep's reads carry the same grammar; the copy that executes it is the
// interpreter in packages/iot/src/procedure/interpreter.ts.
const SETPOINT_PLACEHOLDER = /\{value(?:\.[a-zA-Z0-9_]+)?\}/;
const KEYED_SETPOINT_PLACEHOLDER = /\{value\.[a-zA-Z0-9_]+\}/;

const zSetpointValue = z.union([
  z.number().finite(),
  z.string().min(1).max(64),
  z.record(z.union([z.number().finite(), z.string().min(1).max(64)])),
]);

// Instruments take numbers; labels and compound setpoints are for the operator.
const zInstrumentStimulus = z
  .object({
    instrument: zIdentifier,
    set: zIdentifier,
    values: z.array(z.number().finite()).min(1).max(64),
  })
  .strict();

const zOperatorStimulus = z
  .object({
    operator: z.string().min(1).max(500),
    values: z.array(zSetpointValue).min(1).max(64),
  })
  .strict();

export const zStimulus = z.union([zInstrumentStimulus, zOperatorStimulus]);

// Sent to the device whole; checked here only by name against the procedure's declarations.
const zMeasurementProtocol = z.record(z.unknown());
const MAX_PROTOCOLS = 16;
// Definitions are read on every bench session, so the map is bounded like the
// script (1 MB) and the device info records (16 KB) are.
const PROTOCOLS_MAX_BYTES = 65_536;

const zInstrumentRead = z
  .object({
    instrument: zIdentifier,
    command: z.string().min(1).max(255).optional(),
    protocol: zIdentifier.optional(),
    as: zIdentifier,
    repeat: z.number().int().min(1).max(1000).optional(),
    intervalMs: z.number().int().min(0).max(600_000).optional(),
    timeoutMs: z.number().int().min(1).max(600_000).optional(),
  })
  .strict()
  .refine((read) => (read.command === undefined) !== (read.protocol === undefined), {
    message: "Exactly one of command or protocol is required",
  });

const zOperatorRead = z
  .object({
    operator: z.string().min(1).max(500),
    as: zIdentifier,
    type: z.enum(["number", "text"]),
  })
  .strict();

export const zProcedureRead = z.union([zInstrumentRead, zOperatorRead]);

const zOperatorStep = z
  .object({
    kind: z.literal("operator"),
    prompt: z.string().min(1).max(1000),
    // Typed token gating the step, e.g. "DARK" before the baseline measurement.
    confirm: z.string().min(1).max(32).optional(),
  })
  .strict();

const zSettleStep = z
  .object({
    kind: z.literal("settle"),
    ms: z.number().int().min(1).max(600_000),
  })
  .strict();

// Apply one instrument setpoint and move on; nothing is read.
const zSetStep = z
  .object({
    kind: z.literal("set"),
    instrument: zIdentifier,
    set: zIdentifier,
    value: z.number().finite(),
  })
  .strict();

const zReadStep = z
  .object({
    kind: z.literal("read"),
    series: zIdentifier,
    prompt: z.string().min(1).max(1000).optional(),
    read: z.array(zProcedureRead).min(1).max(16),
    // May legitimately not run (instrument absent, gated step declined); its series may then be missing.
    optional: z.boolean().optional(),
  })
  .strict();

// One row per setpoint: the reserved stimulus column plus one column per read.
const zSweepStep = z
  .object({
    kind: z.literal("sweep"),
    series: zIdentifier,
    stimulus: zStimulus,
    settleMs: z.number().int().min(0).max(600_000).optional(),
    read: z.array(zProcedureRead).min(1).max(16),
    optional: z.boolean().optional(),
  })
  .strict();

export const zProcedureStep = z.discriminatedUnion("kind", [
  zOperatorStep,
  zSettleStep,
  zSetStep,
  zReadStep,
  zSweepStep,
]);

function isInstrumentRead(read: ProcedureRead): read is z.infer<typeof zInstrumentRead> {
  return "instrument" in read;
}

function isInstrumentStimulus(stimulus: Stimulus): stimulus is z.infer<typeof zInstrumentStimulus> {
  return "instrument" in stimulus;
}

/**
 * Every step may produce one series, and a series the operator retook carries a companion,
 * so a payload holds at most twice this many series. The payload bound is derived from
 * these rather than chosen apart from them: a procedure that parses must also submit.
 */
export const MAX_PROCEDURE_STEPS = 64;
export const MAX_VERIFY_STEPS = 16;

/** A bench with more ports than this is a rig the browser cannot ask an operator to open. */
export const MAX_RIG_INSTRUMENTS = 8;

export const zCaptureProcedure = z
  .object({
    instruments: z.array(zRigInstrument).min(1).max(MAX_RIG_INSTRUMENTS),
    protocols: z
      .record(zIdentifier, zMeasurementProtocol)
      .refine((protocols) => Object.keys(protocols).length <= MAX_PROTOCOLS, {
        message: `At most ${MAX_PROTOCOLS} protocols may be declared`,
      })
      .refine((protocols) => JSON.stringify(protocols).length <= PROTOCOLS_MAX_BYTES, {
        message: `Protocols must serialise to at most ${PROTOCOLS_MAX_BYTES} bytes`,
      })
      .optional(),
    steps: z.array(zProcedureStep).min(1).max(MAX_PROCEDURE_STEPS),
    // Runs after the approved coefficients are written; what it reads is kept with the calibration.
    verify: z.array(zProcedureStep).min(1).max(MAX_VERIFY_STEPS).optional(),
  })
  .strict()
  .superRefine((procedure, ctx) => {
    const protocols = new Set(Object.keys(procedure.protocols ?? {}));
    const roles = new Set<string>();
    procedure.instruments.forEach((instrument, index) => {
      if (roles.has(instrument.role)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Instrument role "${instrument.role}" is declared more than once`,
          path: ["instruments", index, "role"],
        });
      }
      roles.add(instrument.role);

      if (instrument.role === DUT_ROLE && "handshake" in instrument) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `The "${DUT_ROLE}" instrument's handshake comes from the family driver`,
          path: ["instruments", index, "handshake"],
        });
      }
    });
    if (!roles.has(DUT_ROLE)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `The rig must declare the "${DUT_ROLE}" instrument`,
        path: ["instruments"],
      });
    }

    const requireDeclaredRole = (role: string, path: (string | number)[]) => {
      if (!roles.has(role)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Instrument "${role}" is not declared in the rig`,
          path,
        });
      }
    };

    // A placeholder resolves against the setpoint a sweep is at; published
    // anywhere else it reaches the bench as literal text.
    const refusePlaceholder = (text: string | undefined, path: (string | number)[]) => {
      if (text !== undefined && SETPOINT_PLACEHOLDER.test(text)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A setpoint placeholder resolves only inside a sweep step",
          path,
        });
      }
    };

    // Each phase names its own series; the capture feeds the script, the verify phase the calibration record.
    const checkSteps = (steps: ProcedureStep[], phase: "steps" | "verify") => {
      const seriesNames = new Set<string>();
      steps.forEach((step, stepIndex) => {
        if (step.kind === "set") {
          requireDeclaredRole(step.instrument, [phase, stepIndex, "instrument"]);
          return;
        }
        if (step.kind === "operator") {
          refusePlaceholder(step.prompt, [phase, stepIndex, "prompt"]);
          return;
        }
        if (step.kind !== "read" && step.kind !== "sweep") {
          return;
        }
        if (step.kind === "read") {
          refusePlaceholder(step.prompt, [phase, stepIndex, "prompt"]);
        }

        if (seriesNames.has(step.series)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Series "${step.series}" is produced by more than one step`,
            path: [phase, stepIndex, "series"],
          });
        }
        // Readings the operator took again are kept under this suffix, so a declared
        // series ending in it would absorb another step's discarded rows and feed them
        // to the fit as real data.
        if (step.series.endsWith(RETAKEN_SERIES_SUFFIX)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `A series name may not end in "${RETAKEN_SERIES_SUFFIX}"; that names the readings a step's operator took again`,
            path: [phase, stepIndex, "series"],
          });
        }
        seriesNames.add(step.series);

        const isSweep = step.kind === "sweep";
        const hasNumericSetpoints = step.kind === "sweep" && isInstrumentStimulus(step.stimulus);

        const checkPlaceholders = (text: string | undefined, path: (string | number)[]) => {
          if (text === undefined) {
            return;
          }

          if (!isSweep) {
            refusePlaceholder(text, path);
          }

          if (hasNumericSetpoints && KEYED_SETPOINT_PLACEHOLDER.test(text)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message:
                "A keyed setpoint placeholder needs a compound setpoint; this sweep steps an instrument through plain numbers",
              path,
            });
          }
        };

        const columns = new Set<string>();
        step.read.forEach((read, readIndex) => {
          if (columns.has(read.as)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Column "${read.as}" is read more than once in this step`,
              path: [phase, stepIndex, "read", readIndex, "as"],
            });
          }
          columns.add(read.as);

          if (isInstrumentRead(read)) {
            requireDeclaredRole(read.instrument, [
              phase,
              stepIndex,
              "read",
              readIndex,
              "instrument",
            ]);

            if (read.protocol !== undefined && !protocols.has(read.protocol)) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Protocol "${read.protocol}" is not declared in the procedure`,
                path: [phase, stepIndex, "read", readIndex, "protocol"],
              });
            }

            // Bench instruments answer named readings, not protocols. Refused
            // here so a definition cannot publish a step the bench would abort on.
            if (read.protocol !== undefined && read.instrument !== DUT_ROLE) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Only the "${DUT_ROLE}" instrument can run a measurement protocol`,
                path: [phase, stepIndex, "read", readIndex, "protocol"],
              });
            }

            const declared =
              read.protocol === undefined ? undefined : procedure.protocols?.[read.protocol];
            const declaredJson = declared === undefined ? undefined : JSON.stringify(declared);

            checkPlaceholders(read.command, [phase, stepIndex, "read", readIndex, "command"]);
            checkPlaceholders(declaredJson, [phase, stepIndex, "read", readIndex, "protocol"]);
          } else {
            checkPlaceholders(read.operator, [phase, stepIndex, "read", readIndex, "operator"]);
          }
        });

        if (step.kind === "sweep") {
          if (columns.has(SWEEP_STIMULUS_COLUMN)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `"${SWEEP_STIMULUS_COLUMN}" is a reserved sweep column`,
              path: [phase, stepIndex, "read"],
            });
          }
          if (isInstrumentStimulus(step.stimulus)) {
            requireDeclaredRole(step.stimulus.instrument, [
              phase,
              stepIndex,
              "stimulus",
              "instrument",
            ]);
          }
        }
      });
    };

    checkSteps(procedure.steps, "steps");
    checkSteps(procedure.verify ?? [], "verify");
  });

/** Every series a procedure can produce; the run payload may carry no others. */
/**
 * A reading the operator took again is kept beside the series it was taken for, under
 * this suffix. The fit never sees it and it is never required; it is there so a reviewer
 * can tell that a point was taken twice and what the discarded attempt said.
 */
export const RETAKEN_SERIES_SUFFIX = "_retaken";

/** The series a payload may carry: those the procedure declares, and their retaken companions. */
export function acceptedSeriesNames(procedure: CaptureProcedure): string[] {
  return procedureSeriesNames(procedure).flatMap((name) => [
    name,
    `${name}${RETAKEN_SERIES_SUFFIX}`,
  ]);
}

export function procedureSeriesNames(procedure: CaptureProcedure): string[] {
  const names: string[] = [];
  for (const step of procedure.steps) {
    if (step.kind === "read" || step.kind === "sweep") {
      names.push(step.series);
    }
  }
  return names;
}

/**
 * Series the payload must carry; optional steps are excluded because a bench
 * missing a reference still produces a useful run.
 */
export function requiredProcedureSeriesNames(procedure: CaptureProcedure): string[] {
  const names: string[] = [];
  for (const step of procedure.steps) {
    if ((step.kind === "read" || step.kind === "sweep") && !step.optional) {
      names.push(step.series);
    }
  }
  return names;
}

/** Series the verify phase produces; a stored verification may carry no others. */
export function verificationSeriesNames(procedure: CaptureProcedure): string[] {
  const names: string[] = [];
  for (const step of procedure.verify ?? []) {
    if (step.kind === "read" || step.kind === "sweep") {
      names.push(step.series);
    }
  }
  return names;
}

/** The verify phase retakes readings like the capture phase does, and reports them the same way. */
export function acceptedVerificationSeriesNames(procedure: CaptureProcedure): string[] {
  return verificationSeriesNames(procedure).flatMap((name) => [
    name,
    `${name}${RETAKEN_SERIES_SUFFIX}`,
  ]);
}

export type RigInstrument = z.infer<typeof zRigInstrument>;
export type MeasurementProtocol = z.infer<typeof zMeasurementProtocol>;
export type Stimulus = z.infer<typeof zStimulus>;
export type ProcedureRead = z.infer<typeof zProcedureRead>;
export type ProcedureStep = z.infer<typeof zProcedureStep>;
export type CaptureProcedure = z.infer<typeof zCaptureProcedure>;
