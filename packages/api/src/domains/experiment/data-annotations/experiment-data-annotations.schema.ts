import { z } from "zod";

// Experiment data annotations
export const zExperimentAnnotationType = z.enum(["comment", "flag"]);

export const zExperimentAnnotationFlagType = z.enum(["outlier", "needs_review"]);

// Use discriminated union to properly differentiate between comment and flag content
export const zExperimentAnnotationCommentContent = z.object({
  type: z.literal("comment"),
  text: z.string().min(1).max(255),
});

export const zExperimentAnnotationFlagContent = z.object({
  type: z.literal("flag"),
  flagType: zExperimentAnnotationFlagType,
  text: z.string().max(255).optional(),
});

export const zExperimentAnnotationContent = z.discriminatedUnion("type", [
  zExperimentAnnotationCommentContent,
  zExperimentAnnotationFlagContent,
]);

export const zExperimentAnnotation = z.object({
  id: z.string().uuid(),
  rowId: z.string().optional(),
  type: zExperimentAnnotationType,
  content: zExperimentAnnotationContent,
  createdBy: z.string().uuid(),
  createdByName: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const zExperimentAnnotationList = z.array(zExperimentAnnotation);

export const zExperimentAnnotationPathParam = z.object({
  id: z.string().uuid().describe("ID of the experiment"),
  annotationId: z.string().uuid().describe("ID of the annotation"),
});

export const zExperimentAddAnnotationBody = z.object({
  tableName: z.string(),
  rowId: z.string().min(1),
  annotation: z.object({
    type: zExperimentAnnotationType,
    content: zExperimentAnnotationContent,
  }),
});

export const zExperimentAddAnnotationsBulkBody = z.object({
  tableName: z.string(),
  rowIds: z.array(z.string().min(1)).min(1),
  annotation: z.object({
    type: zExperimentAnnotationType,
    content: zExperimentAnnotationContent,
  }),
});

export const zExperimentListAnnotationsQuery = z.object({
  page: z.coerce.number().int().min(1).optional().describe("Page number for pagination"),
  pageSize: z.coerce.number().int().min(1).max(100).optional().describe("Number of rows per page"),
  tableName: z.string().describe("Name of the data table"),
});

export const zExperimentUpdateAnnotationBody = z.object({
  content: zExperimentAnnotationContent.describe("Updated content"),
});

export const zExperimentAnnotationDeleteBulkPathParam = z.object({
  id: z.string().uuid().describe("ID of the experiment"),
});

export const zExperimentAnnotationDeleteBulkBody = z.object({
  tableName: z.string().describe("Name of the data table"),
  rowIds: z.array(z.string().min(1)).min(1).describe("Rows IDs to delete"),
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
