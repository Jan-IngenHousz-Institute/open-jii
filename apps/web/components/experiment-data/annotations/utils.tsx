import { Annotations } from "~/components/experiment-data/annotations/annotations";
import type { AnnotationData } from "~/hooks/experiment/useExperimentData/useExperimentData";

import type { Annotation, AnnotationFlagType, AnnotationType } from "@repo/api";

export interface AnnotationsRowIdentifier {
  experimentId: string;
  tableName: string;
  rowId: string;
}

export function getAnnotationData(annotations: Annotation[]): AnnotationData {
  const { annotationsPerType, uniqueFlags } = annotations.reduce(
    (acc, annotation) => {
      if (!(annotation.type in acc.annotationsPerType)) {
        acc.annotationsPerType[annotation.type] = [];
      }
      acc.annotationsPerType[annotation.type].push(annotation);
      if (annotation.type === "flag" && "flagType" in annotation.content) {
        acc.uniqueFlags.add(annotation.content.flagType);
      }
      return acc;
    },
    {
      annotationsPerType: {} as Record<AnnotationType, Annotation[]>,
      uniqueFlags: new Set<AnnotationFlagType>(),
    },
  );

  const count = annotations.length;
  const commentCount = "comment" in annotationsPerType ? annotationsPerType.comment.length : 0;
  const flagCount = "flag" in annotationsPerType ? annotationsPerType.flag.length : 0;

  return { annotations, annotationsPerType, uniqueFlags, count, commentCount, flagCount };
}

export function isAnnotationData(value: unknown): value is AnnotationData {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as AnnotationData).annotations) &&
    typeof (value as AnnotationData).annotationsPerType === "object" &&
    (value as AnnotationData).uniqueFlags instanceof Set &&
    typeof (value as AnnotationData).count === "number" &&
    typeof (value as AnnotationData).commentCount === "number" &&
    typeof (value as AnnotationData).flagCount === "number"
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
