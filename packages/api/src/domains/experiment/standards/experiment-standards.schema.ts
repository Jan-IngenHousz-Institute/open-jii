import { z } from "zod";

import { zExperimentIdPathParam } from "../experiment.schema";

/** Every standard the platform reports on, by its own name. */
export const zStandardId = z.enum([
  "miappe",
  "crop-ontology",
  "common-greenhouse-ontology",
  "openaire",
  "brapi",
  "ogc-sensorthings",
  "fair",
]);

/** The standards a researcher step can exist for, so an experiment may choose to follow them. */
export const zFollowableStandardId = zStandardId.extract([
  "miappe",
  "crop-ontology",
  "common-greenhouse-ontology",
]);

export const zReadinessState = z.enum(["not-assessed", "not-applicable", "partial", "met"]);

const zCount = z.number().int().nonnegative();

/** The columns, plots or people a step acts on, by the names a researcher knows them by. */
const zSubjects = z.array(z.string().min(1));

/** Why a step exists, as a code from the mapping's fixed list. Each code has one fix. */
export const zStepReason = z.discriminatedUnion("code", [
  z.object({ code: z.literal("no-location") }),
  z.object({ code: z.literal("no-layout") }),
  z.object({ code: z.literal("columns-not-described"), subjects: zSubjects }),
  z.object({ code: z.literal("columns-without-term"), subjects: zSubjects }),
  z.object({ code: z.literal("unit-without-greenhouse-term"), subjects: zSubjects }),
  z.object({ code: z.literal("plots-without-treatment"), subjects: zSubjects }),
  z.object({ code: z.literal("plots-measured-twice"), subjects: zSubjects }),
  z.object({ code: z.literal("plots-left-skipped"), subjects: zSubjects }),
  z.object({
    code: z.literal("members-without-orcid"),
    subjects: zSubjects,
    /** Only these members can connect their own iD, so only they are offered the action. */
    includesViewer: z.boolean(),
  }),
]);

export const zStandardsStep = z.object({
  reason: zStepReason,
  /** False when the step waits on other people or only informs, such as plots left skipped. */
  holdsFreeze: z.boolean(),
  /** The standards the step moves. Empty when it holds every dataset, whatever is followed. */
  standards: z.array(zStandardId),
});

/** Where one standard stands, in words the mapping can back for this experiment. */
export const zStandardStatus = z.discriminatedUnion("code", [
  z.object({ code: z.literal("all-filled") }),
  z.object({ code: z.literal("fields-missing"), count: zCount }),
  z.object({ code: z.literal("columns-without-term"), count: zCount }),
  z.object({ code: z.literal("applies-to-greenhouses") }),
  z.object({ code: z.literal("unit-without-greenhouse-term"), unitName: z.string().min(1) }),
  z.object({ code: z.literal("filled-while-publishing") }),
  z.object({ code: z.literal("calls-answer"), count: zCount }),
  z.object({ code: z.literal("under-evaluation") }),
  z.object({ code: z.literal("scored-after-publishing") }),
  z.object({ code: z.literal("scored"), percent: z.number().int().min(0).max(100) }),
]);

export const zStandardReadiness = z.object({
  standard: zStandardId,
  state: zReadinessState,
  filled: zCount.nullable(),
  total: zCount.nullable(),
  status: zStandardStatus,
});

export const zExperimentStandards = z.object({
  /** What the experiment chose, stored on it. The OpenAIRE record is followed without being listed. */
  followed: z.array(zFollowableStandardId),
  standards: z.array(zStandardReadiness),
  /** Ranked, for every standard, so a choice can be previewed before it is saved. */
  steps: z.array(zStandardsStep),
});

export const zUpdateFollowedStandardsBody = z.object({
  followed: z.array(zFollowableStandardId),
});

export const zFieldSource = z.enum([
  "experiment",
  "study-details",
  "layout",
  "data-dictionary",
  "profile",
]);

export const zStandardField = z.discriminatedUnion("status", [
  z.object({
    field: z.string().min(1),
    status: z.literal("filled"),
    value: z.string(),
    source: zFieldSource,
  }),
  z.object({
    field: z.string().min(1),
    status: z.literal("missing"),
    reason: zStepReason,
  }),
]);

/** The official validator's verdict on the latest package exported for this experiment. */
export const zValidatorVerdict = z.object({
  passed: z.boolean(),
  checkedAt: z.string().datetime(),
});

export const zStandardFields = z.object({
  standard: zStandardId,
  filled: zCount,
  total: zCount,
  /** Only the plant phenotyping checklist has a validator, and it is null until a package exists. */
  validator: zValidatorVerdict.nullable(),
  fields: z.array(zStandardField),
});

export const zStandardFieldsPathParam = zExperimentIdPathParam.extend({ standard: zStandardId });

export type StandardId = z.infer<typeof zStandardId>;
export type FollowableStandardId = z.infer<typeof zFollowableStandardId>;
export type ReadinessState = z.infer<typeof zReadinessState>;
export type StepReason = z.infer<typeof zStepReason>;
export type StepReasonCode = StepReason["code"];
export type StandardsStep = z.infer<typeof zStandardsStep>;
export type StandardStatus = z.infer<typeof zStandardStatus>;
export type StandardReadiness = z.infer<typeof zStandardReadiness>;
export type ExperimentStandards = z.infer<typeof zExperimentStandards>;
export type UpdateFollowedStandardsBody = z.infer<typeof zUpdateFollowedStandardsBody>;
export type FieldSource = z.infer<typeof zFieldSource>;
export type StandardField = z.infer<typeof zStandardField>;
export type MissingStandardField = Extract<StandardField, { status: "missing" }>;
export type FilledStandardField = Extract<StandardField, { status: "filled" }>;
export type ValidatorVerdict = z.infer<typeof zValidatorVerdict>;
export type StandardFields = z.infer<typeof zStandardFields>;

/** Every experiment follows the OpenAIRE record, so it is never stored and cannot be removed. */
export const ALWAYS_FOLLOWED: StandardId = "openaire";
