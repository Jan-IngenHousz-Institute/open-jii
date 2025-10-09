import { Annotations } from "~/components/experiment-data/annotations/annotations";
import type { AnnotationData } from "~/hooks/experiment/useExperimentData/useExperimentData";

export interface AnnotationsRowIdentifier {
  experimentId: string;
  tableName: string;
  rowId: string;
}

export function getAnnotationsColumn(
  annotationsRowId: AnnotationsRowIdentifier,
  annotationData: AnnotationData,
) {
  return (
    <Annotations
      experimentId={annotationsRowId.experimentId}
      tableName={annotationsRowId.tableName}
      rowIds={[annotationsRowId.rowId]}
      data={annotationData}
    />
  );
}
