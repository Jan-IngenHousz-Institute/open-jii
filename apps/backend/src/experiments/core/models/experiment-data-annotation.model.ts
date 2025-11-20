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
  contentText?: string | null; // For comment annotations
  flagType?: string | null; // 'outlier' or 'needs_review'
  flagReason?: string | null; // Reason for flag
  createdAt: Date;
  updatedAt: Date;
}

// Input type for creating annotations
export type CreateAnnotationDto = Omit<BaseAnnotation, "id" | "createdAt" | "updatedAt">;

// Input type for updating annotations
export type UpdateAnnotationDto = Partial<
  Pick<BaseAnnotation, "contentText" | "flagType" | "flagReason">
>;

// Output type from database
export type AnnotationDto = BaseAnnotation;
