import { parseAnnotations } from "~/components/experiment-data/table-cells/annotations/experiment-data-table-annotations-cell";

import type {
  Annotation,
  AnnotationType,
  AnnotationContent,
  ExperimentDataResponse,
  DataColumn,
} from "@repo/api";

// The type string for the annotations column
const ANNOTATIONS_COLUMN_TYPE =
  "ARRAY<STRUCT<id: STRING, rowId: STRING, type: STRING, content: STRUCT<text: STRING, flagType: STRING>, createdBy: STRING, createdByName: STRING, createdAt: TIMESTAMP, updatedAt: TIMESTAMP>>";

/**
 * Find the annotations column in the experiment data columns
 */
function findAnnotationsColumnName(data: ExperimentDataResponse): string | null {
  const tableData = data[0]?.data;
  if (!tableData?.columns || tableData.columns.length === 0) return null;

  const annotationColumn = tableData.columns.find(
    (col: DataColumn) => col.type_text === ANNOTATIONS_COLUMN_TYPE,
  );

  return annotationColumn?.name ?? null;
}

/**
 * Create a new annotation object from the annotation request data
 */
function createAnnotationFromRequest(
  annotation: { type: AnnotationType; content: AnnotationContent },
  rowId: string,
): Annotation & { preview: boolean } {
  // Generate a temporary ID for optimistic updates
  const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return {
    id: tempId,
    rowId,
    type: annotation.type,
    content: annotation.content,
    createdBy: "current-user", // Will be replaced when server responds
    createdByName: "You", // Localized placeholder for current user
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    preview: true, // Mark as preview for optimistic updates
  };
}

/**
 * Create a deep copy of data using structuredClone (modern browsers) or JSON fallback
 */
function deepCopy<T>(data: T): T {
  // Use structuredClone if available (modern browsers)
  if (typeof structuredClone !== "undefined") {
    return structuredClone(data);
  }

  // Fallback to JSON for older environments
  return JSON.parse(JSON.stringify(data)) as T;
}

/**
 * Hook for optimistic updates to experiment annotation data
 */
export function useExperimentAnnotationOptimisticUpdate() {
  /**
   * Update experiment data with new annotations (append to existing)
   */
  const update = (
    data: ExperimentDataResponse,
    tableName: string,
    rowIds: string[],
    annotationRequest: { type: AnnotationType; content: AnnotationContent },
  ): ExperimentDataResponse => {
    if (!data[0]?.data) return data;

    const annotationColumnName = findAnnotationsColumnName(data);
    if (!annotationColumnName) return data; // No annotations column found

    // Create a deep copy of the data
    const updatedData = deepCopy(data);
    const tableData = updatedData[0];

    // Only update if this is the correct table
    if (tableData.name !== tableName) return data;

    // Update each row that matches the rowIds
    if (tableData.data?.rows) {
      tableData.data.rows.forEach((row: Record<string, unknown>) => {
        const rowId = row.id as string;

        // Only update if row has a proper ID and is in the target list
        if (rowId && rowIds.includes(rowId)) {
          // Parse existing annotations
          const existingAnnotationsString = (row[annotationColumnName] as string) || "[]";
          const existingAnnotations = parseAnnotations(existingAnnotationsString);

          // Create new annotation
          const newAnnotation = createAnnotationFromRequest(annotationRequest, rowId);

          // Append new annotation to existing ones
          const updatedAnnotations = [...existingAnnotations, newAnnotation];

          // Update the row with the new annotations JSON
          row[annotationColumnName] = JSON.stringify(updatedAnnotations);
        }
      });
    }

    return updatedData;
  };

  /**
   * Remove a single annotation from experiment data by annotation ID
   */
  const remove = (data: ExperimentDataResponse, annotationId: string): ExperimentDataResponse => {
    if (!data[0]?.data) return data;

    const annotationColumnName = findAnnotationsColumnName(data);
    if (!annotationColumnName) return data;

    // Create a deep copy of the data
    const updatedData = deepCopy(data);
    const tableData = updatedData[0];

    // Update each row to remove the annotation
    if (tableData.data?.rows) {
      tableData.data.rows.forEach((row: Record<string, unknown>) => {
        const existingAnnotationsString = (row[annotationColumnName] as string) || "[]";
        const existingAnnotations = parseAnnotations(existingAnnotationsString);

        // Filter out the annotation with the matching ID
        const updatedAnnotations = existingAnnotations.filter(
          (annotation) => annotation.id !== annotationId,
        );

        // Update the row with the filtered annotations JSON
        row[annotationColumnName] = JSON.stringify(updatedAnnotations);
      });
    }

    return updatedData;
  };

  /**
   * Remove multiple annotations from experiment data by row IDs and type
   */
  const removeBulk = (
    data: ExperimentDataResponse,
    tableName: string,
    rowIds: string[],
    annotationType: AnnotationType,
  ): ExperimentDataResponse => {
    if (!data[0]?.data) return data;

    const annotationColumnName = findAnnotationsColumnName(data);
    if (!annotationColumnName) return data;

    // Create a deep copy of the data
    const updatedData = deepCopy(data);
    const tableData = updatedData[0];

    // Only update if this is the correct table
    if (tableData.name !== tableName) return data;

    // Update each row that matches the rowIds
    if (tableData.data?.rows) {
      tableData.data.rows.forEach((row: Record<string, unknown>) => {
        const rowId = row.id as string;

        // Only update if row has a proper ID and is in the target list
        if (rowId && rowIds.includes(rowId)) {
          const existingAnnotationsString = (row[annotationColumnName] as string) || "[]";
          const existingAnnotations = parseAnnotations(existingAnnotationsString);

          // Filter out annotations of the specified type for this row
          const updatedAnnotations = existingAnnotations.filter(
            (annotation) => !(annotation.type === annotationType && annotation.rowId === rowId),
          );

          // Update the row with the filtered annotations JSON
          row[annotationColumnName] = JSON.stringify(updatedAnnotations);
        }
      });
    }

    return updatedData;
  };

  return {
    update,
    remove,
    removeBulk,
  };
}
