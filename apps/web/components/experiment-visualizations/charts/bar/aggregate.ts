import { WellKnownColumnTypes } from "@repo/api/schemas/experiment.schema";

export type AggregationFunction = "count" | "sum" | "avg" | "min" | "max";

export interface ContributorCell {
  id: string;
  name: string;
  avatar: string | null;
}

export interface QuestionEntry {
  questionLabel: string;
  questionText: string | null;
  questionAnswer: string | null;
}

export interface AggregatedBucket {
  key: string;
  label: string;
  value: number;
  count: number;
}

export const UNKNOWN_KEY = "__unknown__";
export const UNKNOWN_LABEL = "Unknown";

/**
 * Parse a row's `contributor` cell. The backend serialises CONTRIBUTOR
 * structs as JSON strings on the wire, but already-parsed objects also pass
 * through (e.g. test fixtures, future API shapes). Returns null when the
 * cell can't be interpreted; callers bucket those rows under "Unknown".
 */
export function parseContributorCell(raw: unknown): ContributorCell | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.id === "string" && typeof obj.name === "string") {
      return {
        id: obj.id,
        name: obj.name,
        avatar: typeof obj.avatar === "string" ? obj.avatar : null,
      };
    }
    return null;
  }
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") return parseContributorCell(parsed);
    return null;
  } catch {
    return null;
  }
}

/**
 * Parse a row's `questions` cell. Returns the array as-is when already
 * deserialised, parses it from a JSON string when the API returned it as
 * text, and returns an empty array otherwise — callers treat "no entry
 * matched" as Unknown, identical to a null cell.
 */
export function parseQuestionsCell(raw: unknown): QuestionEntry[] {
  let arr: unknown = raw;
  if (typeof raw === "string") {
    if (raw === "") return [];
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  const out: QuestionEntry[] = [];
  for (const entry of arr) {
    if (!entry || typeof entry !== "object") continue;
    const obj = entry as Record<string, unknown>;
    const questionLabel =
      typeof obj.question_label === "string"
        ? obj.question_label
        : typeof obj.questionLabel === "string"
          ? obj.questionLabel
          : null;
    if (!questionLabel) continue;
    out.push({
      questionLabel,
      questionText:
        typeof obj.question_text === "string"
          ? obj.question_text
          : typeof obj.questionText === "string"
            ? obj.questionText
            : null,
      questionAnswer:
        typeof obj.question_answer === "string"
          ? obj.question_answer
          : typeof obj.questionAnswer === "string"
            ? obj.questionAnswer
            : null,
    });
  }
  return out;
}

interface GroupKeyOptions {
  isContributor?: boolean;
  isQuestions?: boolean;
  /** Required when `isQuestions` is true; selects which question's answer to group by. */
  questionLabel?: string;
}

function extractGroupKey(value: unknown, opts: GroupKeyOptions): { key: string; label: string } {
  if (opts.isContributor) {
    const c = parseContributorCell(value);
    if (c) return { key: c.id, label: c.name };
    return { key: UNKNOWN_KEY, label: UNKNOWN_LABEL };
  }
  if (opts.isQuestions) {
    // Without a picked question label we can't choose which entry's answer
    // to use, so the bucket isn't meaningful — collapse to Unknown.
    if (!opts.questionLabel) return { key: UNKNOWN_KEY, label: UNKNOWN_LABEL };
    const entries = parseQuestionsCell(value);
    const match = entries.find((e) => e.questionLabel === opts.questionLabel);
    const answer = match?.questionAnswer;
    if (answer == null || answer === "") {
      return { key: UNKNOWN_KEY, label: UNKNOWN_LABEL };
    }
    return { key: answer, label: answer };
  }
  // Only primitive-like cells produce meaningful string keys. Anything else
  // (objects, functions, symbols) would collapse into "[object Object]" or
  // throw, so we treat those as Unknown rather than merge unrelated rows
  // into one bucket.
  if (typeof value === "string") {
    if (value === "") return { key: UNKNOWN_KEY, label: UNKNOWN_LABEL };
    return { key: value, label: value };
  }
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
    const stringified = String(value);
    return { key: stringified, label: stringified };
  }
  return { key: UNKNOWN_KEY, label: UNKNOWN_LABEL };
}

function toNumeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Group rows by the value of `xColumn` and apply `fn`. With `fn = "count"`,
 * each bucket's value is the row count; with sum/avg/min/max, only finite
 * numeric values of `yColumn` contribute — null cells are skipped so they
 * don't drag the mean toward zero or fabricate min=0 buckets.
 *
 * When `xColumnType` is the CONTRIBUTOR well-known struct, cells are
 * parsed as `{ id, name, avatar }` and grouped by id but labelled by name.
 * When `xColumnType` is the QUESTIONS array, `options.questionLabel` picks
 * one entry per row and its `question_answer` becomes the group key — a
 * row without a matching entry collapses to "Unknown".
 */
export function groupAndAggregate(
  rows: Record<string, unknown>[],
  xColumn: string | undefined,
  xColumnType: string | undefined,
  yColumn: string | undefined,
  fn: AggregationFunction,
  options: { questionLabel?: string } = {},
): AggregatedBucket[] {
  if (!xColumn) return [];

  const keyOpts: GroupKeyOptions = {
    isContributor: xColumnType === WellKnownColumnTypes.CONTRIBUTOR,
    isQuestions: xColumnType === WellKnownColumnTypes.QUESTIONS,
    questionLabel: options.questionLabel,
  };
  const buckets = new Map<string, { label: string; numericValues: number[]; rowCount: number }>();

  for (const row of rows) {
    const { key, label } = extractGroupKey(row[xColumn], keyOpts);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { label, numericValues: [], rowCount: 0 };
      buckets.set(key, bucket);
    }
    bucket.rowCount += 1;
    if (yColumn) {
      const n = toNumeric(row[yColumn]);
      if (n !== null) bucket.numericValues.push(n);
    }
  }

  const out: AggregatedBucket[] = [];
  for (const [key, bucket] of buckets) {
    const { numericValues, rowCount, label } = bucket;
    let value = 0;
    if (fn === "count") {
      value = rowCount;
    } else if (numericValues.length > 0) {
      const sum = numericValues.reduce((acc, n) => acc + n, 0);
      if (fn === "sum") value = sum;
      else if (fn === "avg") value = sum / numericValues.length;
      else if (fn === "min")
        value = numericValues.reduce((acc, n) => (n < acc ? n : acc), numericValues[0]);
      else value = numericValues.reduce((acc, n) => (n > acc ? n : acc), numericValues[0]);
    }
    out.push({ key, label, value, count: rowCount });
  }
  return out;
}

/**
 * Walk `rows` and return the unique `question_label` values found in the
 * cells of `xColumn`, in first-seen order. Used by the bar data panel to
 * populate the "Question" picker without a separate API call.
 */
export function collectQuestionLabels(
  rows: Record<string, unknown>[],
  xColumn: string | undefined,
): string[] {
  if (!xColumn) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    const entries = parseQuestionsCell(row[xColumn]);
    for (const e of entries) {
      if (!seen.has(e.questionLabel)) {
        seen.add(e.questionLabel);
        out.push(e.questionLabel);
      }
    }
  }
  return out;
}

/**
 * Sort buckets by `value` and trim to `topN`. `sortDirection = null`
 * preserves insertion order, which matches the typical histogram
 * "one bar per group" reading order.
 */
export function applyTopN(
  buckets: AggregatedBucket[],
  sortDirection: "asc" | "desc" | null | undefined,
  topN: number | undefined,
): AggregatedBucket[] {
  let result = buckets;
  if (sortDirection === "asc" || sortDirection === "desc") {
    result = [...buckets].sort((a, b) =>
      sortDirection === "asc" ? a.value - b.value : b.value - a.value,
    );
  }
  if (typeof topN === "number" && topN > 0 && result.length > topN) {
    result = result.slice(0, topN);
  }
  return result;
}
