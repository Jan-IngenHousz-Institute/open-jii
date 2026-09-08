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
  })
  .strict();

export const zRigInstrument = z.union([zDutInstrument, zAuxiliaryInstrument]);

// An operator prompt may interpolate the setpoint with {value} or {value.key}.
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
  zReadStep,
  zSweepStep,
]);

function isInstrumentRead(read: ProcedureRead): read is z.infer<typeof zInstrumentRead> {
  return "instrument" in read;
}

function isInstrumentStimulus(stimulus: Stimulus): stimulus is z.infer<typeof zInstrumentStimulus> {
  return "instrument" in stimulus;
}

export const zCaptureProcedure = z
  .object({
    instruments: z.array(zRigInstrument).min(1).max(8),
    protocols: z
      .record(zIdentifier, zMeasurementProtocol)
      .refine((protocols) => Object.keys(protocols).length <= MAX_PROTOCOLS, {
        message: `At most ${MAX_PROTOCOLS} protocols may be declared`,
      })
      .optional(),
    steps: z.array(zProcedureStep).min(1).max(64),
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

    const seriesNames = new Set<string>();
    procedure.steps.forEach((step, stepIndex) => {
      if (step.kind !== "read" && step.kind !== "sweep") {
        return;
      }

      if (seriesNames.has(step.series)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Series "${step.series}" is produced by more than one step`,
          path: ["steps", stepIndex, "series"],
        });
      }
      seriesNames.add(step.series);

      const columns = new Set<string>();
      step.read.forEach((read, readIndex) => {
        if (columns.has(read.as)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Column "${read.as}" is read more than once in this step`,
            path: ["steps", stepIndex, "read", readIndex, "as"],
          });
        }
        columns.add(read.as);

        if (isInstrumentRead(read)) {
          requireDeclaredRole(read.instrument, [
            "steps",
            stepIndex,
            "read",
            readIndex,
            "instrument",
          ]);

          if (read.protocol !== undefined && !protocols.has(read.protocol)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Protocol "${read.protocol}" is not declared in the procedure`,
              path: ["steps", stepIndex, "read", readIndex, "protocol"],
            });
          }
        }
      });

      if (step.kind === "sweep") {
        if (columns.has(SWEEP_STIMULUS_COLUMN)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `"${SWEEP_STIMULUS_COLUMN}" is a reserved sweep column`,
            path: ["steps", stepIndex, "read"],
          });
        }
        if (isInstrumentStimulus(step.stimulus)) {
          requireDeclaredRole(step.stimulus.instrument, [
            "steps",
            stepIndex,
            "stimulus",
            "instrument",
          ]);
        }
      }
    });
  });

/** Every series a procedure can produce; the run payload may carry no others. */
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

export type RigInstrument = z.infer<typeof zRigInstrument>;
export type MeasurementProtocol = z.infer<typeof zMeasurementProtocol>;
export type Stimulus = z.infer<typeof zStimulus>;
export type ProcedureRead = z.infer<typeof zProcedureRead>;
export type ProcedureStep = z.infer<typeof zProcedureStep>;
export type CaptureProcedure = z.infer<typeof zCaptureProcedure>;
