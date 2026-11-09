import { z } from "zod";

// Experiment data annotations
export const zExperimentAnnotationType = z.enum(["comment", "flag"]);

export const zExperimentAnnotationFlagType = z.enum(["outlier", "needs_review"]);

// Postgres keeps no NUL character in text, and rows and tables by names of up to 64.
const zNoNulText = z
  .string()
  .refine((text) => !text.includes("\u0000"), "Text cannot hold a NUL character");
const zRowId = zNoNulText.min(1).max(64);
const zTableName = zNoNulText.min(1).max(64);
// Lowercase, as Postgres prints a uuid, so the lakehouse and Postgres match an id alike.
const zLowercaseId = z.string().guid().toLowerCase();

// Use discriminated union to properly differentiate between comment and flag content
export const zExperimentAnnotationCommentContent = z.object({
  type: z.literal("comment"),
  text: zNoNulText.min(1).max(255),
});

export const zExperimentAnnotationFlagContent = z.object({
  type: z.literal("flag"),
  flagType: zExperimentAnnotationFlagType,
  text: zNoNulText.max(255).optional(),
});

export const zExperimentAnnotationContent = z.discriminatedUnion("type", [
  zExperimentAnnotationCommentContent,
  zExperimentAnnotationFlagContent,
]);

export const zExperimentAnnotation = z.object({
  id: z.string().guid(),
  rowId: z.string().optional(),
  type: zExperimentAnnotationType,
  content: zExperimentAnnotationContent,
  createdBy: z.string().guid(),
  createdByName: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const zExperimentAnnotationList = z.array(zExperimentAnnotation);

export const zExperimentAnnotationPathParam = z.object({
  id: zLowercaseId.describe("ID of the experiment"),
  annotationId: zLowercaseId.describe("ID of the annotation"),
});

// The type is stored apart from the content, so they must agree: a flag keeps its kind, a comment
// its text.
const zNewAnnotation = z
  .object({
    type: zExperimentAnnotationType,
    content: zExperimentAnnotationContent,
  })
  .refine((annotation) => annotation.type === annotation.content.type, {
    message: "The annotation's type must match its content's type",
    path: ["content", "type"],
  });

export const zExperimentAddAnnotationBody = z.object({
  tableName: zTableName,
  rowId: zRowId,
  annotation: zNewAnnotation,
});

export const zExperimentAddAnnotationsBulkBody = z.object({
  tableName: zTableName,
  rowIds: z.array(zRowId).min(1),
  annotation: zNewAnnotation,
});

export const zExperimentListAnnotationsQuery = z.object({
  page: z.coerce.number().int().min(1).optional().describe("Page number for pagination"),
  pageSize: z.coerce.number().int().min(1).max(100).optional().describe("Number of rows per page"),
  tableName: z.string().describe("Name of the data table"),
});

export const zExperimentUpdateAnnotationBody = z.object({
  content: zExperimentAnnotationContent.describe("Updated content"),
});

export const zExperimentAnnotationExperimentPathParam = z.object({
  id: zLowercaseId.describe("ID of the experiment"),
});

export const zExperimentAnnotationDeleteBulkBody = z.object({
  tableName: zTableName.describe("Name of the data table"),
  rowIds: z.array(zRowId).min(1).describe("Rows IDs to delete"),
  type: zExperimentAnnotationType.describe("Type of annotations to delete"),
});

export const zExperimentAnnotationRowsAffected = z.object({
  rowsAffected: z.number().int(),
});

export type ExperimentAnnotationType = z.infer<typeof zExperimentAnnotationType>;
export type ExperimentAnnotationFlagType = z.infer<typeof zExperimentAnnotationFlagType>;
export type ExperimentAnnotationContent = z.infer<typeof zExperimentAnnotationContent>;
export type ExperimentAnnotationCommentContent = z.infer<
  typeof zExperimentAnnotationCommentContent
>;
export type ExperimentAnnotationFlagContent = z.infer<typeof zExperimentAnnotationFlagContent>;
export type ExperimentAnnotation = z.infer<typeof zExperimentAnnotation>;
export type ExperimentAddAnnotationBody = z.infer<typeof zExperimentAddAnnotationBody>;
export type ExperimentAddAnnotationsBulkBody = z.infer<typeof zExperimentAddAnnotationsBulkBody>;
export type ExperimentUpdateAnnotationBody = z.infer<typeof zExperimentUpdateAnnotationBody>;
export type ExperimentAnnotationRowsAffected = z.infer<typeof zExperimentAnnotationRowsAffected>;

export type ExperimentDeleteAnnotationsBulkBody = z.infer<
  typeof zExperimentAnnotationDeleteBulkBody
>;
