import { z } from "zod";

import { zExperimentIdPathParam } from "../experiment.schema";

/**
 * Every profile the platform reports on, by its own name. Vocabularies such as Crop Ontology are
 * preferred by a profile rather than followed on their own.
 */
export const zStandardId = z.enum(["miappe", "ro-crate", "brapi", "ogc-sensorthings", "fair"]);

/** The profiles a researcher step can exist for, so an experiment may choose to follow them. */
export const zFollowableStandardId = zStandardId.extract(["miappe"]);

export const zReadinessState = z.enum(["not-assessed", "not-applicable", "partial", "met"]);

const zCount = z.number().int().nonnegative();

/** The columns, plots, fields or people a step acts on, by the names a researcher knows them by. */
const zSubjects = z.array(z.string().min(1));

/** Why a step exists, as a code from the mapping's fixed list of twelve. Each code has one fix. */
export const zStepReason = z.discriminatedUnion("code", [
  z.object({ code: z.literal("no-location") }),
  z.object({ code: z.literal("no-layout") }),
  z.object({ code: z.literal("study-details-missing"), subjects: zSubjects }),
  z.object({ code: z.literal("columns-not-described"), subjects: zSubjects }),
  z.object({ code: z.literal("columns-without-method-or-scale"), subjects: zSubjects }),
  z.object({ code: z.literal("columns-without-term"), subjects: zSubjects }),
  z.object({ code: z.literal("unit-without-type"), unitName: z.string().min(1) }),
  /** The plot attributes with no role yet, which a profile that reads the design needs. */
  z.object({ code: z.literal("attributes-without-role"), subjects: zSubjects }),
  z.object({ code: z.literal("plots-measured-twice"), subjects: zSubjects }),
  z.object({ code: z.literal("plots-left-skipped"), subjects: zSubjects }),
  z.object({
    code: z.literal("members-without-orcid"),
    subjects: zSubjects,
    /** Only these members can connect their own iD, so only they are offered the action. */
    includesViewer: z.boolean(),
  }),
  z.object({
    code: z.literal("members-without-affiliation"),
    subjects: zSubjects,
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
  /** Counted over the profile's required fields, the same basis as its field panel. */
  z.object({ code: z.literal("fields-missing"), count: zCount, total: zCount }),
  z.object({ code: z.literal("filled-while-publishing") }),
  z.object({ code: z.literal("every-frozen-dataset") }),
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
  /** What the experiment chose, stored on it. A new experiment follows nothing. */
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
  "author-list",
  /** Set by the standard itself, such as the version of its checklist. */
  "standard",
]);

export const zStandardField = z.discriminatedUnion("status", [
  z.object({
    field: z.string().min(1),
    status: z.literal("filled"),
    value: z.string(),
    source: zFieldSource,
    /** Computed by the platform from its source, such as a plot count, so it changes only there. */
    derived: z.boolean(),
  }),
  z.object({
    field: z.string().min(1),
    status: z.literal("missing"),
    reason: zStepReason,
  }),
]);

/** The official validator's verdict on the package of the latest frozen dataset. */
export const zValidatorVerdict = z.object({
  passed: z.boolean(),
  checkedAt: z.string().datetime(),
});

export const zStandardFields = z.object({
  standard: zStandardId,
  filled: zCount,
  /** The profile's required fields, the basis every count of this standard uses. */
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
