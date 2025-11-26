/**
 * Experiment annotation interfaces for storing comments and flags on experiment data
 */

// Base annotation interface
export interface BaseAnnotation {
  id: string;
  userId: string;
  tableName: string;
  rowId: string;
  type: string; // 'comment' or 'flag'
  contentText?: string | null; // For comment annotations or reasons for flags
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
