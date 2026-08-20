import { describe, expect, it } from "vitest";

import { MAX_INPUT_ROWS, parseBulkBatch } from "./bulk-register-parse";

const NONE = new Set<string>();

describe("parseBulkBatch", () => {
  it("splits serial and name on comma, semicolon, or tab", () => {
    const batch = parseBulkBatch("S-1, North gate\nS-2;South gate\nS-3\tEast gate\nS-4", NONE);

    expect(batch.ready).toEqual([
      { serialNumber: "S-1", name: "North gate" },
      { serialNumber: "S-2", name: "South gate" },
      { serialNumber: "S-3", name: "East gate" },
      { serialNumber: "S-4" },
    ]);
  });

  it("classifies every line instead of failing the batch on one bad row", () => {
    const batch = parseBulkBatch("S-1\nnot a serial!!\nS-1\nS-2", new Set(["S-2"]));

    expect(batch.rows.map((row) => row.status)).toEqual([
      "ready",
      "invalid",
      "duplicate",
      "registered",
    ]);
    expect(batch.counts).toEqual({ ready: 1, invalid: 1, duplicate: 1, registered: 1 });
    // Only the ready row travels; the rest stay visible but excluded.
    expect(batch.ready).toEqual([{ serialNumber: "S-1" }]);
  });

  it("skips blank lines and trims whitespace", () => {
    const batch = parseBulkBatch("\n  S-1  \n\n", NONE);

    expect(batch.rows).toHaveLength(1);
    expect(batch.ready).toEqual([{ serialNumber: "S-1" }]);
  });

  it("stops parsing past the line cap and flags the overflow", () => {
    const text = Array.from({ length: MAX_INPUT_ROWS + 1 }, (_, i) => `S-${String(i)}`).join("\n");

    const batch = parseBulkBatch(text, new Set());

    expect(batch.rows).toHaveLength(MAX_INPUT_ROWS);
    expect(batch.overLineLimit).toBe(true);
    expect(parseBulkBatch("S-1", new Set()).overLineLimit).toBe(false);
  });
});
