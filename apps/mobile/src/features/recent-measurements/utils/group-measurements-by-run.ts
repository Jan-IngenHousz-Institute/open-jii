import type { MeasurementItem } from "~/features/recent-measurements/hooks/use-all-measurements";
import type { MeasurementStatus } from "~/shared/db/measurement-status";
import { isUnsynced } from "~/shared/db/measurement-status";
import type { AnswerData } from "~/shared/measurements/convert-cycle-answers-to-array";

/**
 * One Recent-list entry: either a single measurement (`runId === ""`) or every
 * measurement of one workbook run, collapsed behind an expandable row.
 */
export interface MeasurementRunEntry {
  /** List key: `run:<id>` for a group, the measurement key for a single row. */
  key: string;
  /** The workbook run this entry collapses; "" for a standalone measurement. */
  runId: string;
  items: MeasurementItem[];
}

/**
 * Collapses the measurements of one workbook run (multi-device rounds and the
 * sequential cells of a single attempt all share `workbookRunId`) into one
 * entry, positioned where the run's newest measurement sat. Rows with no run id
 * (legacy, pre-backfill, questions-only saves from older versions) and runs that
 * produced a single measurement stay standalone rows: a dropdown around one item
 * is just noise. Input order is preserved; no sorting, no date parsing, so this
 * stays cheap enough for the list build path (see OJD-1470).
 */
export function groupMeasurementsByRun(items: MeasurementItem[]): MeasurementRunEntry[] {
  const byRun = new Map<string, MeasurementItem[]>();
  for (const item of items) {
    if (!item.workbookRunId) continue;
    const bucket = byRun.get(item.workbookRunId);
    if (bucket) bucket.push(item);
    else byRun.set(item.workbookRunId, [item]);
  }

  const entries: MeasurementRunEntry[] = [];
  const emitted = new Set<string>();
  for (const item of items) {
    const bucket = item.workbookRunId ? byRun.get(item.workbookRunId) : undefined;
    if (!bucket || bucket.length < 2) {
      entries.push({ key: item.key, runId: "", items: [item] });
      continue;
    }
    if (emitted.has(item.workbookRunId)) continue;
    emitted.add(item.workbookRunId);
    entries.push({ key: `run:${item.workbookRunId}`, runId: item.workbookRunId, items: bucket });
  }
  return entries;
}

export interface RunSummary {
  count: number;
  /** Worst-of, so a run with one failed upload still reads as failed. */
  status: MeasurementStatus;
  experimentName: string;
  /** Newest measurement in the run; drives the "x minutes ago" label. */
  timestamp: string;
  questions: AnswerData[];
  hasComment: boolean;
  hasUnsynced: boolean;
}

/** Row-level aggregate for a collapsed run. Assumes a non-empty `items`. */
export function summarizeRun(items: MeasurementItem[]): RunSummary {
  let status: MeasurementStatus = "successful";
  let timestamp = items[0].timestamp;
  let questions: AnswerData[] = [];
  let hasComment = false;
  let hasUnsynced = false;

  for (const item of items) {
    if (item.status === "failed") status = "failed";
    else if (item.status === "pending" && status !== "failed") status = "pending";
    // Timestamps are UTC ISO strings, so a lexicographic compare orders them.
    if (item.timestamp > timestamp) timestamp = item.timestamp;
    if (questions.length === 0 && item.questions.length > 0) questions = item.questions;
    if (item.hasComment) hasComment = true;
    if (isUnsynced(item.status)) hasUnsynced = true;
  }

  return {
    count: items.length,
    status,
    experimentName: items[0].experimentName,
    timestamp,
    questions,
    hasComment,
    hasUnsynced,
  };
}
