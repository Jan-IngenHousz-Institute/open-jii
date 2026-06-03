import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import type { MeasurementItem } from "~/features/recent-measurements/hooks/use-all-measurements";
import { groupMeasurementsByDay } from "~/features/recent-measurements/utils/group-measurements-by-day";

const NOW = DateTime.fromISO("2026-05-18T10:00:00", { zone: "utc" });

function item(iso: string, key = iso): MeasurementItem {
  return {
    id: key,
    key,
    timestamp: iso,
    experimentName: "exp",
    protocolName: "proto",
    status: "successful",
    questions: [],
    hasComment: false,
    dayKey: iso.split("T")[0],
  };
}

describe("groupMeasurementsByDay", () => {
  it("returns an empty array when given no items", () => {
    expect(groupMeasurementsByDay([], NOW)).toEqual([]);
  });

  it("flags today / yesterday / other correctly", () => {
    const sections = groupMeasurementsByDay(
      [
        item("2026-05-18T08:42:00Z", "today-1"),
        item("2026-05-18T06:30:00Z", "today-2"),
        item("2026-05-17T17:15:00Z", "yesterday-1"),
        item("2026-05-15T14:08:00Z", "other-1"),
      ],
      NOW,
    );

    expect(sections.map((s) => s.kind)).toEqual(["today", "yesterday", "other"]);
    expect(sections.map((s) => s.data.length)).toEqual([2, 1, 1]);
  });

  it("preserves descending day order even when input is shuffled", () => {
    const sections = groupMeasurementsByDay(
      [item("2026-05-15T14:00:00Z"), item("2026-05-18T08:00:00Z"), item("2026-05-17T17:00:00Z")],
      NOW,
    );
    expect(sections.map((s) => s.key)).toEqual(["2026-05-18", "2026-05-17", "2026-05-15"]);
  });

  it("skips items with an invalid timestamp", () => {
    const sections = groupMeasurementsByDay(
      [item("not-an-iso", "bad"), item("2026-05-18T08:00:00Z")],
      NOW,
    );
    expect(sections).toHaveLength(1);
    expect(sections[0].data).toHaveLength(1);
  });

  it("produces a locale-formatted date label", () => {
    const sections = groupMeasurementsByDay([item("2026-05-18T08:00:00Z")], NOW, "en-GB");
    expect(sections[0].dateLabel).toMatch(/Mon\s+18\s+May/);
  });
});
