/**
 * Helpers for measurement annotations (comments) compatible with the pipeline
 * (centrum_pipeline expects annotations array with type "comment", content: { text, flagType }).
 */

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
  flagType?: string | null,
): { type: string; content: { text: string; flagType: string | null } }[] {
  const annotations: { type: string; content: { text: string; flagType: string | null } }[] = [];

  if (commentText?.trim()) {
    annotations.push({ type: "comment", content: { text: commentText.trim(), flagType: null } });
  }

  if (flagType) {
    annotations.push({ type: "flag", content: { text: "", flagType } });
  }

  return annotations;
}
