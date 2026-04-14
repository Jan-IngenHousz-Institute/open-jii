/**
 * Helpers for measurement annotations (comments) compatible with the pipeline
 * (centrum_pipeline expects annotations array with type "comment", content: { text, flagType }).
 */

import { type AnnotationFlagType } from "@repo/api";

export const FLAG_TYPE_LABELS: Record<AnnotationFlagType, string> = {
  outlier: "Outlier",
  needs_review: "Needs Review",
};

type CommentAnnotation = { type: "comment"; content: { text: string; flagType: null } };
type FlagAnnotation = { type: "flag"; content: { text: string; flagType: AnnotationFlagType } };
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

/** Build annotations array from optional comment text and/or flag type. */
export function buildAnnotations(
  commentText?: string,
  flagType?: AnnotationFlagType | null,
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
