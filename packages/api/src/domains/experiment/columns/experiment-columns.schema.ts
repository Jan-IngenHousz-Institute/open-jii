import { z } from "zod";

/**
 * What produced a column: an instrument running a workbook version, a macro, the experiment's
 * layout, or nothing known.
 */
export const zColumnProducer = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("instrument"),
    workbookVersion: z.number().int().positive(),
    workbookName: z.string().optional(),
  }),
  z.object({
    kind: z.literal("macro"),
    macroId: z.string().uuid(),
    macroName: z.string(),
  }),
  z.object({ kind: z.literal("layout") }),
  z.object({ kind: z.literal("unknown") }),
]);

/** A Crop Ontology term, identified as `CO_<ontology>:<number>`. */
export const zColumnTerm = z.object({
  id: z.string().regex(/^CO_\d+:\d+$/),
  label: z.string(),
  definition: z.string().optional().describe("What the ontology says the term means"),
});

export const zColumnDescription = z.object({
  trait: z.string().trim().min(1, "The trait is required").max(255),
  traitTerm: zColumnTerm.nullable(),
  noTermFits: z
    .boolean()
    .optional()
    .describe("The researcher looked and found no Crop Ontology term for the trait"),
  method: z.string().trim().max(500).nullable(),
  methodTerm: zColumnTerm.nullable(),
  scale: z.string().trim().max(255).nullable(),
  scaleTerm: zColumnTerm.nullable(),
  unit: z.string().trim().max(64).nullable(),
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
export type DictionaryColumn = z.infer<typeof zDictionaryColumn>;
export type DictionaryGroup = z.infer<typeof zDictionaryGroup>;
export type ColumnDictionary = z.infer<typeof zColumnDictionary>;
export type ColumnTermSearchResponse = z.infer<typeof zColumnTermSearchResponse>;
export type ColumnSuggestion = z.infer<typeof zColumnSuggestion>;
