/**
 * Experiment annotation interfaces for storing comments and flags on experiment data
 */
import type {
  ExperimentAnnotationCommentContent,
  ExperimentAnnotationFlagContent,
  ExperimentAnnotationFlagType,
  ExperimentAnnotationType,
} from "@repo/api/domains/experiment/data-annotations/experiment-data-annotations.schema";

// Type guards
export function isCommentContent(content: unknown): content is ExperimentAnnotationCommentContent {
  return (
    typeof content === "object" &&
    content !== null &&
    "type" in content &&
    content.type === "comment" &&
    "text" in content
  );
}

export function isFlagContent(content: unknown): content is ExperimentAnnotationFlagContent {
  return (
    typeof content === "object" &&
    content !== null &&
    "type" in content &&
    content.type === "flag" &&
    "flagType" in content
  );
}

// Base annotation interface
export interface BaseAnnotation {
  id: string;
  userId: string;
  userName?: string | null; // User's full name from profile
  tableName: string;
  rowId: string;
  type: string; // 'comment' or 'flag'
  contentText?: string | null; // For comment text or flag reason
  flagType?: ExperimentAnnotationFlagType | null;
  createdAt: Date;
  updatedAt: Date;
}

// Input type for creating annotations
export type CreateAnnotationDto = Omit<BaseAnnotation, "id" | "createdAt" | "updatedAt">;

/** An annotation with the id and times it gets in every place that keeps it. */
export interface AnnotationRecord {
  id: string;
  experimentId: string;
  tableName: string;
  rowId: string;
  type: ExperimentAnnotationType;
  contentText: string | null;
  flagType: ExperimentAnnotationFlagType | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Input type for updating annotations
export type UpdateAnnotationDto = Partial<Pick<BaseAnnotation, "contentText" | "flagType">>;

// Output type from database
export type AnnotationDto = BaseAnnotation;

// Use case type for deleting annotations
export interface DeleteAnnotation {
  annotationId: string;
}

export interface DeleteBulkAnnotations {
  tableName: string;
  rowIds: string[];
  type: ExperimentAnnotationType;
}

export type DeleteAnnotationsRequest = DeleteAnnotation | DeleteBulkAnnotations;
