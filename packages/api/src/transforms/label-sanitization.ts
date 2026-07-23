/**
 * Canonicalize a flow node label to the column key the data pipeline emits
 * for `questions_data`. Allowlist: lowercase ASCII letters, digits, underscore;
 * everything else collapses to `_`. Mirrors `sanitize_label` in
 * apps/data/src/pipelines/centrum_pipeline.py. Keep them in sync.
 */
export function sanitizeQuestionLabel(label: string): string {
  if (!label) return "question_empty";
  let s = label.toLowerCase().replace(/[^a-z0-9_]+/g, "_");
  s = s.replace(/^_+|_+$/g, "");
  if (!s || /^\d/.test(s)) s = `question_${s}`;
  return s;
}

/**
 * Strip characters outside the allowlist (ASCII letters, digits, underscore,
 * and space) from a user-typed value. Useful for inputs whose value later
 * feeds a stricter canonicalizer like `sanitizeQuestionLabel`: without it,
 * disallowed characters are silently folded (e.g. "weather1ç" -> "weather1"),
 * so two visibly different names can collide. Spaces are kept for readability.
 */
export function stripSpecialCharacters(value: string): string {
  return value.replace(/[^a-zA-Z0-9_ ]/g, "");
}
