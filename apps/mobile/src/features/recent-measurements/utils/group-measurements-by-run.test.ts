import { describe, expect, it } from "vitest";
import type { MeasurementItem } from "~/features/recent-measurements/hooks/use-all-measurements";
import {
  groupMeasurementsByRun,
  summarizeRun,
} from "~/features/recent-measurements/utils/group-measurements-by-run";
import type { MeasurementStatus } from "~/shared/db/measurements-storage";

function item(
  key: string,
  workbookRunId: string,
  overrides: Partial<MeasurementItem> = {},
): MeasurementItem {
  return {
    id: key,
    key,
    timestamp: "2026-05-18T08:00:00.000Z",
    experimentName: "exp",
    protocolName: "proto",
    status: "successful",
    questions: [],
    hasComment: false,
    dayKey: "2026-05-18",
    workbookRunId,
    ...overrides,
  };
}

describe("groupMeasurementsByRun", () => {
  it("returns an empty array when given no items", () => {
    expect(groupMeasurementsByRun([])).toEqual([]);
  });

  it("collapses measurements that share a workbook run into one entry", () => {
    const entries = groupMeasurementsByRun([item("a", "run-1"), item("b", "run-1")]);

    expect(entries).toHaveLength(1);
    expect(entries[0].key).toBe("run:run-1");
    expect(entries[0].runId).toBe("run-1");
    expect(entries[0].items.map((i) => i.key)).toEqual(["a", "b"]);
  });

  it("leaves a run that produced a single measurement as a plain row", () => {
    const entries = groupMeasurementsByRun([item("a", "run-1")]);

    expect(entries).toHaveLength(1);
    expect(entries[0].runId).toBe("");
    expect(entries[0].key).toBe("a");
  });

  it("never groups rows without a run id, even when several are missing it", () => {
    const entries = groupMeasurementsByRun([item("a", ""), item("b", "")]);

    expect(entries.map((e) => e.key)).toEqual(["a", "b"]);
    expect(entries.every((e) => e.runId === "")).toBe(true);
  });

  it("keeps list order, placing a run where its first measurement sat", () => {
    const entries = groupMeasurementsByRun([
      item("solo-1", ""),
      item("a", "run-1"),
      item("b", "run-1"),
      item("solo-2", "run-2"),
    ]);

    expect(entries.map((e) => e.key)).toEqual(["solo-1", "run:run-1", "solo-2"]);
  });

  it("pulls in later members of a run that other rows interleave", () => {
    const entries = groupMeasurementsByRun([
      item("a", "run-1"),
      item("other", ""),
      item("b", "run-1"),
    ]);

    expect(entries.map((e) => e.key)).toEqual(["run:run-1", "other"]);
    expect(entries[0].items.map((i) => i.key)).toEqual(["a", "b"]);
  });

  it("emits one entry per run", () => {
    const entries = groupMeasurementsByRun([
      item("a", "run-1"),
      item("b", "run-1"),
      item("c", "run-2"),
      item("d", "run-2"),
    ]);

    expect(entries.map((e) => e.key)).toEqual(["run:run-1", "run:run-2"]);
    expect(entries.map((e) => e.items.length)).toEqual([2, 2]);
  });
});

describe("summarizeRun", () => {
  const statuses = (...list: MeasurementStatus[]) =>
    list.map((status, i) => item(`m${i}`, "run-1", { status }));

  it("counts the measurements in the run", () => {
    expect(summarizeRun(statuses("successful", "successful")).count).toBe(2);
  });

  it("reports failed when any measurement failed", () => {
    expect(summarizeRun(statuses("successful", "pending", "failed")).status).toBe("failed");
  });

  it("reports pending when some are still queued and none failed", () => {
    expect(summarizeRun(statuses("successful", "pending")).status).toBe("pending");
  });

  it("reports successful only when every measurement synced", () => {
    const summary = summarizeRun(statuses("successful", "successful"));
    expect(summary.status).toBe("successful");
    expect(summary.hasUnsynced).toBe(false);
  });

  it("flags unsynced work for the upload action", () => {
    expect(summarizeRun(statuses("successful", "failed")).hasUnsynced).toBe(true);
  });

  it("takes the newest timestamp in the run", () => {
    const summary = summarizeRun([
      item("a", "run-1", { timestamp: "2026-05-18T08:00:00.000Z" }),
      item("b", "run-1", { timestamp: "2026-05-18T09:30:00.000Z" }),
      item("c", "run-1", { timestamp: "2026-05-18T07:00:00.000Z" }),
    ]);
    expect(summary.timestamp).toBe("2026-05-18T09:30:00.000Z");
  });

  it("surfaces the first answers found and any comment in the run", () => {
    const answers = [{ question_label: "q1", question_text: "What?", question_answer: "Yes" }];
    const summary = summarizeRun([
      item("a", "run-1"),
      item("b", "run-1", { questions: answers, hasComment: true }),
    ]);
    expect(summary.questions).toEqual(answers);
    expect(summary.hasComment).toBe(true);
  });
});
