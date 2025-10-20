import type { AnnotationContent, AnnotationType } from "@repo/api";

export interface ExperimentDataAnnotation {
  id: string;
  experimentId: string;
  userId: string;
  dataReference: DataReference;
  type: AnnotationType;
  content: AnnotationContent;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
}

export interface DataReference {
  tableName?: string;
  rowId?: string;
}

// Validation schemas

export interface AnnotationFilters {
  types?: AnnotationType[];
  userId?: string;
  dateRange?: { from: Date; to: Date };
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}
