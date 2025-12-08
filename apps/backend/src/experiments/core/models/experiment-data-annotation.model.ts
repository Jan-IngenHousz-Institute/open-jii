/**
 * Experiment annotation interfaces for storing comments and flags on experiment data
 */
import type { AnnotationCommentContent, AnnotationFlagContent } from "@repo/api";

// Type guards
export function isCommentContent(content: unknown): content is AnnotationCommentContent {
  return (
    typeof content === "object" &&
    content !== null &&
    "type" in content &&
    content.type === "comment" &&
    "text" in content
  );
}

export function isFlagContent(content: unknown): content is AnnotationFlagContent {
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
  flagType?: string | null; // 'outlier' or 'needs_review'
  createdAt: Date;
  updatedAt: Date;
}

// Input type for creating annotations
export type CreateAnnotationDto = Omit<BaseAnnotation, "id" | "createdAt" | "updatedAt">;

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
  type: string;
}

export type DeleteAnnotationsRequest = DeleteAnnotation | DeleteBulkAnnotations;
