/**
 * Experiment annotation interfaces for storing comments and flags on experiment data
 */
import type {
  ExperimentAnnotationFlagContent,
  ExperimentAnnotationFlagType,
  ExperimentAnnotationType,
} from "@repo/api/domains/experiment/data-annotations/experiment-data-annotations.schema";

// Type guards
export function isFlagContent(content: unknown): content is ExperimentAnnotationFlagContent {
  return (
    typeof content === "object" &&
    content !== null &&
    "type" in content &&
    content.type === "flag" &&
    "flagType" in content
  );
}

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

/** An annotation as its copies take it, with its author's name as it reads now. */
export interface AnnotationCopy extends AnnotationRecord {
  userName: string | null;
}

// Input type for updating annotations
export type UpdateAnnotationDto = Partial<Pick<AnnotationRecord, "contentText" | "flagType">>;

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
