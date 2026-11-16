import { z } from "zod";

/**
 * What produced a column: an instrument running a workbook version, a macro, an upload read by a
 * platform parser, the experiment's layout, or nothing known.
 */
export const zColumnProducer = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("instrument"),
    workbookVersion: z.number().int().positive(),
    workbookName: z.string().optional(),
    instrumentFamily: z.string().optional().describe("The device family, such as Ambit"),
  }),
  z.object({
    kind: z.literal("macro"),
    macroId: z.string().uuid(),
    macroName: z.string(),
  }),
  z.object({
    kind: z.literal("upload"),
    parserName: z.string().describe("The platform parser that read the files, such as Ambyte"),
    parserVersion: z.string(),
  }),
  z.object({ kind: z.literal("layout") }),
  z.object({ kind: z.literal("unknown") }),
]);

/** A term from any vocabulary the term search covers, such as ENVO or the CF standard names. */
export const zColumnTerm = z.object({
  id: z.string().min(1).describe("The term's identifier, such as ENVO:00002005 or air_temperature"),
  label: z.string(),
  vocabulary: z.string().min(1).describe("Where the term comes from, such as CF standard names"),
  iri: z.string().url().optional(),
  definition: z.string().optional().describe("What the vocabulary says the term means"),
});

export const zColumnValueKind = z.enum(["number", "count", "category", "text", "trace"]);

export const zColumnProcessingLevel = z.enum(["measured", "calibrated", "computed"]);

/** UCUM codes are case-sensitive ASCII without spaces, such as Cel, % or umol/(m2.s). */
const UCUM_CODE = /^[!-~]+$/;

/** What a column measures, following I-ADOPT: a property of an object of interest. */
export const zColumnDescription = z.object({
  definition: z.string().trim().min(1, "The definition is required").max(1000),
  property: z.string().trim().min(1, "The property is required").max(255),
  propertyTerm: zColumnTerm.nullable(),
  noTermFits: z
    .boolean()
    .optional()
    .describe("The researcher looked and found no term for the property"),
  objectOfInterest: z.string().trim().max(255).nullable(),
  objectOfInterestTerm: zColumnTerm.nullable(),
  context: z.string().trim().max(255).nullable(),
  contextTerm: zColumnTerm.nullable(),
  method: z.string().trim().max(500).nullable(),
  unit: z
    .string()
    .trim()
    .max(64)
    .regex(UCUM_CODE, "Write the unit as a UCUM code without spaces, such as umol/(m2.s)")
    .nullable(),
  valueKind: zColumnValueKind.nullable(),
  processingLevel: zColumnProcessingLevel.nullable(),
});

export const zDictionaryColumn = z.object({
  /** The producer and the column's path in its output, stable across renames. */
  identity: z.string().min(1),
  name: z.string(),
  type: z.string().describe("The column's type as the warehouse names it, such as DOUBLE"),
  rowCount: z.number().int().nonnegative().describe("Rows carrying a value for this column"),
  description: zColumnDescription.nullable(),
  previous: z
    .string()
    .nullable()
    .optional()
    .describe("The identity this column had under the workbook's previous version, if it had one"),
  isSuggested: z
    .boolean()
    .optional()
    .describe("Nobody described it here, and another experiment or an earlier version did"),
});

export const zDictionaryGroup = z.object({
  producer: zColumnProducer,
  columns: z.array(zDictionaryColumn),
});

export const zColumnDictionary = z.object({
  groups: z.array(zDictionaryGroup),
});

export const zColumnTermSearchQuery = z.object({
  query: z.string().trim().min(2).max(100),
});

export const zColumnTermSearchResponse = z.object({
  terms: z.array(zColumnTerm),
  unreachable: z
    .array(z.string())
    .optional()
    .describe("Sources that did not answer, so the terms leave them out"),
});

export const zColumnIdentityQuery = z.object({
  column: z.string().min(1).describe("The column's identity"),
});

/** A description other experiments accepted for the same column, with how many accepted it. */
export const zColumnSuggestion = z.object({
  description: zColumnDescription,
  experimentCount: z.number().int().positive(),
});

export const zDescribeColumnBody = zColumnIdentityQuery.merge(zColumnDescription);

export type ColumnProducer = z.infer<typeof zColumnProducer>;
export type ColumnTerm = z.infer<typeof zColumnTerm>;
export type ColumnDescription = z.infer<typeof zColumnDescription>;
export type ColumnValueKind = z.infer<typeof zColumnValueKind>;
export type ColumnProcessingLevel = z.infer<typeof zColumnProcessingLevel>;
export type DescribeColumnBody = z.infer<typeof zDescribeColumnBody>;
export type DictionaryColumn = z.infer<typeof zDictionaryColumn>;
export type DictionaryGroup = z.infer<typeof zDictionaryGroup>;
export type ColumnDictionary = z.infer<typeof zColumnDictionary>;
export type ColumnTermSearchResponse = z.infer<typeof zColumnTermSearchResponse>;
export type ColumnSuggestion = z.infer<typeof zColumnSuggestion>;
