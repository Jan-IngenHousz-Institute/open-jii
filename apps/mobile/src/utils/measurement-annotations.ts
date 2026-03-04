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

/** Build annotations array with a single comment (replaces any existing comment). */
export function buildAnnotationsWithComment(text: string): {
  type: string;
  content: { text: string; flagType: null };
}[] {
  if (!text.trim()) return [];
  return [
    {
      type: "comment",
      content: { text: text.trim(), flagType: null },
    },
  ];
}
