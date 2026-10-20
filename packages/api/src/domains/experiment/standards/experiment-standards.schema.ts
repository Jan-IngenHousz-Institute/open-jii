import { z } from "zod";

import { zExperimentIdPathParam } from "../experiment.schema";

/** The six standards the readiness screen reports on, then the OpenAIRE floor. */
export const zStandardId = z.enum([
  "fair",
  "crop-ontology",
  "common-greenhouse-ontology",
  "miappe",
  "brapi",
  "ogc-sensorthings",
  "openaire-floor",
]);

export const zReadinessState = z.enum(["not-assessed", "not-applicable", "partial", "met"]);

const zCount = z.number().int().nonnegative();

/** Why a row stands where it does, as a code from the mapping's fixed list of reasons. */
export const zReadinessReason = z.discriminatedUnion("code", [
  z.object({ code: z.literal("no-published-dataset") }),
  z.object({ code: z.literal("columns-without-term"), count: zCount }),
  z.object({ code: z.literal("unit-without-greenhouse-term"), unitName: z.string().min(1) }),
  z.object({ code: z.literal("fields-not-fillable"), count: zCount }),
  z.object({ code: z.literal("calls-pass"), count: zCount }),
  z.object({ code: z.literal("under-evaluation") }),
  z.object({ code: z.literal("funding-missing"), fromDataset: zCount }),
  z.object({ code: z.literal("fields-from-dataset"), count: zCount }),
]);

export const zStandardReadiness = z.object({
  standard: zStandardId,
  state: zReadinessState,
  filled: zCount.nullable(),
  total: zCount.nullable(),
  reason: zReadinessReason,
});

export const zExperimentStandardsReadiness = z.object({
  standards: z.array(zStandardReadiness),
});

export const zFieldSource = z.enum(["experiment", "study-details", "layout", "data-dictionary", "profile"]);

/** The screen that fills a missing field. */
export const zFieldFix = z.enum(["connect-orcid", "describe-columns", "open-layout", "add-location"]);

export const zMissingFieldReason = z.discriminatedUnion("code", [
  z.object({ code: z.literal("authors-without-orcid"), count: zCount }),
  z.object({ code: z.literal("columns-not-described"), count: zCount }),
  z.object({ code: z.literal("no-plot-genotype") }),
  z.object({ code: z.literal("no-location") }),
]);

const zFieldIdentity = z.object({
  /** The standard's own section, such as Investigation or Study in MIAPPE. */
  section: z.string().min(1),
  field: z.string().min(1),
});

export const zStandardField = z.discriminatedUnion("status", [
  zFieldIdentity.extend({
    status: z.literal("filled"),
    value: z.string(),
    source: zFieldSource,
  }),
  zFieldIdentity.extend({
    status: z.literal("missing"),
    reason: zMissingFieldReason,
    fix: zFieldFix,
  }),
]);

export const zStandardFields = z.object({
  standard: zStandardId,
  filled: zCount,
  total: zCount,
  fields: z.array(zStandardField),
});

export const zStandardFieldsPathParam = zExperimentIdPathParam.extend({ standard: zStandardId });

export type StandardId = z.infer<typeof zStandardId>;
export type ReadinessState = z.infer<typeof zReadinessState>;
export type ReadinessReason = z.infer<typeof zReadinessReason>;
export type StandardReadiness = z.infer<typeof zStandardReadiness>;
export type ExperimentStandardsReadiness = z.infer<typeof zExperimentStandardsReadiness>;
export type FieldSource = z.infer<typeof zFieldSource>;
export type FieldFix = z.infer<typeof zFieldFix>;
export type MissingFieldReason = z.infer<typeof zMissingFieldReason>;
export type StandardField = z.infer<typeof zStandardField>;
export type StandardFields = z.infer<typeof zStandardFields>;
