import React from "react";
import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";
import { Annotations } from "~/components/experiment-data/annotations/annotations";
import type { BulkSelectionFormType } from "~/components/experiment-data/experiment-data-table";
import type {
  AnnotationData,
  DataRow,
} from "~/hooks/experiment/useExperimentData/useExperimentData";

import type { Annotation, AnnotationType } from "@repo/api";
import { Checkbox, FormControl, FormField, FormItem } from "@repo/ui/components";

export interface AnnotationsRowIdentifier {
  experimentId: string;
  tableName: string;
  rowId: string;
}

export function getAnnotationData(annotations: Annotation[]): AnnotationData {
  const { annotationsPerType } = annotations.reduce(
    (acc, annotation) => {
      if (!(annotation.type in acc.annotationsPerType)) {
        acc.annotationsPerType[annotation.type] = [];
      }
      acc.annotationsPerType[annotation.type].push(annotation);
      return acc;
    },
    {
      annotationsPerType: {} as Record<AnnotationType, Annotation[]>,
    },
  );

  const count = annotations.length;
  const commentCount = "comment" in annotationsPerType ? annotationsPerType.comment.length : 0;

  return { annotations, annotationsPerType, count, commentCount };
}

export function isAnnotationData(value: unknown): value is AnnotationData {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as AnnotationData).annotations) &&
    typeof (value as AnnotationData).annotationsPerType === "object" &&
    typeof (value as AnnotationData).count === "number" &&
    typeof (value as AnnotationData).commentCount === "number"
  );
}

export function getAllRowsSelectionCheckbox(form: UseFormReturn<BulkSelectionFormType>) {
  return (
    <FormField
      control={form.control}
      name="selectAll"
      render={() => {
        const allRows = useWatch({ control: form.control, name: "allRows" });
        const selectedRows = useWatch({ control: form.control, name: "selectedRowId" });

        // Compute the select all state
        const isAllSelected = allRows.length > 0 && selectedRows.length === allRows.length;
        const isIndeterminate = selectedRows.length > 0 && selectedRows.length < allRows.length;
        const checked = isIndeterminate ? "indeterminate" : isAllSelected;

        return (
          <FormItem>
            <FormControl>
              <Checkbox
                id="selectAllRows"
                name="selectAllRows"
                checked={checked}
                onCheckedChange={(checked) => {
                  if (checked) {
                    // Select all rows
                    form.setValue("selectedRowId", allRows);
                  } else {
                    // Deselect all rows
                    form.setValue("selectedRowId", []);
                  }
                }}
              />
            </FormControl>
          </FormItem>
        );
      }}
    />
  );
}

export function getRowSelectionCheckbox(form: UseFormReturn<BulkSelectionFormType>, id: string) {
  return (
    <FormField
      control={form.control}
      name="selectedRowId"
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <Checkbox
              id={`${field.name}-${id}`}
              name={`${field.name}-${id}`}
              checked={field.value.includes(id)}
              onCheckedChange={(checked) => {
                if (checked) {
                  // Add ID to array if not already present
                  if (!field.value.includes(id)) {
                    field.onChange([...field.value, id]);
                  }
                } else {
                  // Remove ID from array
                  field.onChange(field.value.filter((selectedId) => selectedId !== id));
                }
              }}
              ref={field.ref}
              disabled={field.disabled}
              onBlur={field.onBlur}
              value={id}
            />
          </FormControl>
        </FormItem>
      )}
    />
  );
}

export function getAnnotationsColumn(
  annotationsRowId: AnnotationsRowIdentifier,
  annotationData: unknown,
) {
  if (!isAnnotationData(annotationData)) return null;

  return (
    <Annotations
      experimentId={annotationsRowId.experimentId}
      tableName={annotationsRowId.tableName}
      rowIds={[annotationsRowId.rowId]}
      data={annotationData}
    />
  );
}

export function getTotalSelectedCounts(tableRows: DataRow[] | undefined, selectedRowIds: string[]) {
  if (!tableRows) return { totalSelectedComments: 0 };

  return tableRows
    .filter((row) => row.id && row.annotations && selectedRowIds.includes(row.id as string))
    .flatMap((row) => row.annotations as AnnotationData)
    .reduce(
      (acc, annotation) => ({
        totalSelectedComments:
          acc.totalSelectedComments +
          (annotation.commentCount > 0 ? annotation.annotationsPerType.comment.length : 0),
      }),
      { totalSelectedComments: 0 },
    );
}
