/**
 * Helpers for measurement annotations (comments) compatible with the pipeline
 * (centrum_pipeline expects annotations array with type "comment", content: { text, flagType }).
 */
import type { ExperimentAnnotationFlagType } from "@repo/api/domains/experiment/experiment.schema";

export const FLAG_TYPE_LABELS: Record<ExperimentAnnotationFlagType, string> = {
  outlier: "Outlier",
  needs_review: "Needs Review",
};

interface CommentAnnotation {
  type: "comment";
  content: { text: string; flagType: null };
}
interface FlagAnnotation {
  type: "flag";
  content: { text: string; flagType: ExperimentAnnotationFlagType };
}
type MeasurementAnnotation = CommentAnnotation | FlagAnnotation;

export function getCommentFromMeasurementResult(
  measurementResult: Record<string, unknown>,
): string {
  const annotations = measurementResult?.annotations as
    | { type?: string; content?: { text?: string } }[]
    | undefined;
  if (!Array.isArray(annotations)) return "";
  const comment = annotations.find((a) => a?.type === "comment");
  return comment?.content?.text ?? "";
}

export function getFlagTypeFromMeasurementResult(
  measurementResult: Record<string, unknown>,
): ExperimentAnnotationFlagType | null {
  const annotations = measurementResult?.annotations as
    | { type?: string; content?: { flagType?: ExperimentAnnotationFlagType } }[]
    | undefined;
  if (!Array.isArray(annotations)) return null;
  const flag = annotations.find((a) => a?.type === "flag");
  return flag?.content?.flagType ?? null;
}

/** Build annotations array from optional comment text and/or flag type. */
export function buildAnnotations(
  commentText?: string,
  flagType?: ExperimentAnnotationFlagType | null,
): MeasurementAnnotation[] {
  const annotations: MeasurementAnnotation[] = [];

  if (commentText?.trim()) {
    annotations.push({ type: "comment", content: { text: commentText.trim(), flagType: null } });
  }

  if (flagType) {
    annotations.push({ type: "flag", content: { text: "", flagType } });
  }

  return annotations;
}
