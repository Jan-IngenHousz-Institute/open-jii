import { createCalibrationDefinitionSummary } from "@/test/factories";
import { describe, expect, it } from "vitest";

import { toVersionLines } from "./calibration-version-lines";

describe("toVersionLines", () => {
  // Every version of a name stays readable, because a run records the version it ran.
  // The library lists the line, not each version of it.
  it("groups versions of one name into a single line, newest first", () => {
    const lines = toVersionLines([
      createCalibrationDefinitionSummary({ name: "PAR bench", version: 1 }),
      createCalibrationDefinitionSummary({ name: "PAR bench", version: 3 }),
      createCalibrationDefinitionSummary({ name: "PAR bench", version: 2 }),
    ]);

    expect(lines).toHaveLength(1);
    expect(lines[0].versions.map((version) => version.version)).toEqual([3, 2, 1]);
    expect(lines[0].latest.version).toBe(3);
  });

  it("orders lines by the version that moved them last", () => {
    const lines = toVersionLines([
      createCalibrationDefinitionSummary({
        name: "Older bench",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
      createCalibrationDefinitionSummary({
        name: "Newer bench",
        updatedAt: "2026-09-01T00:00:00.000Z",
      }),
    ]);

    expect(lines.map((line) => line.name)).toEqual(["Newer bench", "Older bench"]);
  });

  it("has no lines for nothing", () => {
    expect(toVersionLines([])).toEqual([]);
  });
});
