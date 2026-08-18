import { describe, expect, it } from "vitest";

import type { DeviceMeasurement } from "@repo/api/domains/iot/iot.schema";

import {
  buildMeasurementValueTable,
  inferColumnType,
  MEASURED_AT_COLUMN,
} from "./measurement-values";

function measurement(
  sample: string | null,
  timestamp = "2026-08-14T09:00:00.000Z",
): DeviceMeasurement {
  return {
    timestamp,
    experimentId: null,
    protocolId: null,
    workbookVersionId: null,
    deviceVersion: "1.1.0",
    battery: null,
    latitude: null,
    longitude: null,
    sample,
  };
}

function columnNames(columns: { name: string }[]): string[] {
  return columns.map((column) => column.name);
}

describe("buildMeasurementValueTable", () => {
  it("turns a single reading object into one row with a column per field", () => {
    const table = buildMeasurementValueTable([
      measurement(JSON.stringify({ light_intensity: 1000, leaf_temp: 22.4 })),
    ]);

    expect(table.rows).toHaveLength(1);
    expect(columnNames(table.columns)).toEqual([
      MEASURED_AT_COLUMN,
      "light_intensity",
      "leaf_temp",
    ]);
    expect(table.rows[0].leaf_temp).toBe(22.4);
    expect(table.rows[0][MEASURED_AT_COLUMN]).toBe("2026-08-14T09:00:00.000Z");
  });

  it("expands a burst into one row per reading", () => {
    const table = buildMeasurementValueTable([
      measurement(JSON.stringify([{ phi2: 0.6 }, { phi2: 0.61 }, { phi2: 0.59 }])),
    ]);

    expect(table.rows).toHaveLength(3);
    // Readings of one burst share a timestamp, so the row ids must not.
    expect(new Set(table.rows.map((row) => row.id)).size).toBe(3);
  });

  it("keeps every field the device reported, ranked by how often it appeared", () => {
    const many = Object.fromEntries(
      Array.from({ length: 12 }, (_, index) => [`field_${String(index)}`, index]),
    );
    const table = buildMeasurementValueTable([
      measurement(JSON.stringify({ always: 1 })),
      measurement(JSON.stringify({ always: 2, ...many })),
    ]);

    // The timestamp leads, then the field present on both readings; nothing is
    // dropped, the table simply scrolls.
    expect(columnNames(table.columns).slice(0, 2)).toEqual([MEASURED_AT_COLUMN, "always"]);
    expect(table.columns).toHaveLength(14);
  });

  it("carries a complex value as JSON text, for the cell that expands it", () => {
    const table = buildMeasurementValueTable([
      measurement(JSON.stringify({ envelope: { gain: 3 }, spectrum: [1, 2, 3] })),
    ]);

    expect(table.rows[0].envelope).toBe('{"gain":3}');
    expect(table.rows[0].spectrum).toBe("[1,2,3]");
    expect(table.columns.find((column) => column.name === "spectrum")?.type_text).toBe(
      "ARRAY<DOUBLE>",
    );
  });

  it("skips samples that are absent or unparsable rather than failing the table", () => {
    const table = buildMeasurementValueTable([
      measurement(null),
      measurement("not json"),
      measurement(JSON.stringify({ ok: 1 })),
    ]);

    expect(table.rows).toHaveLength(1);
  });
});

describe("inferColumnType", () => {
  it("types a field from every value seen for it", () => {
    expect(inferColumnType([3, 4])).toBe("BIGINT");
    expect(inferColumnType([3.5])).toBe("DOUBLE");
    expect(inferColumnType([true, false])).toBe("BOOLEAN");
    expect(inferColumnType(["x"])).toBe("STRING");
    expect(inferColumnType([{ nested: 1 }])).toBe("VARIANT");
  });

  it("reads whole numbers and fractions as one numeric field", () => {
    expect(inferColumnType([3, 3.5])).toBe("DOUBLE");
  });

  it("falls back to text when the values disagree on type", () => {
    expect(inferColumnType([3, "n/a"])).toBe("STRING");
  });

  it("separates numeric arrays, which plot, from arrays that do not", () => {
    expect(inferColumnType([[1, 2, 3]])).toBe("ARRAY<DOUBLE>");
    expect(inferColumnType([[{ id: "a" }]])).toBe("ARRAY<STRUCT>");
    expect(inferColumnType([["a", "b"]])).toBe("ARRAY<STRING>");
  });
});
