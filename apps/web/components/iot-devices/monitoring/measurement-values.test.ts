import { describe, expect, it } from "vitest";

import type { DeviceMeasurement } from "@repo/api/domains/iot/iot.schema";

import { buildMeasurementValueTable, inferColumnType } from "./measurement-values";

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

describe("buildMeasurementValueTable", () => {
  it("turns a single reading object into one row of its fields", () => {
    const table = buildMeasurementValueTable([
      measurement(JSON.stringify({ light_intensity: 1000, leaf_temp: 22.4 })),
    ]);

    expect(table.rows).toHaveLength(1);
    expect(table.columns).toEqual(expect.arrayContaining(["light_intensity", "leaf_temp"]));
    expect(table.rows[0].values.leaf_temp).toBe(22.4);
  });

  it("expands a burst into one row per reading", () => {
    const table = buildMeasurementValueTable([
      measurement(JSON.stringify([{ phi2: 0.6 }, { phi2: 0.61 }, { phi2: 0.59 }])),
    ]);

    expect(table.rows).toHaveLength(3);
  });

  it("ranks the most consistently reported fields first and discloses the surplus", () => {
    const many = Object.fromEntries(
      Array.from({ length: 12 }, (_, index) => [`field_${String(index)}`, index]),
    );
    const table = buildMeasurementValueTable([
      measurement(JSON.stringify({ always: 1 })),
      measurement(JSON.stringify({ always: 2, ...many })),
    ]);

    expect(table.columns[0]).toBe("always");
    expect(table.columns).toHaveLength(8);
    expect(table.hiddenColumnCount).toBe(5);
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
  it("types values so the shared cell formatter renders them correctly", () => {
    expect(inferColumnType(3)).toBe("INT");
    expect(inferColumnType(3.5)).toBe("DOUBLE");
    expect(inferColumnType(true)).toBe("BOOLEAN");
    expect(inferColumnType("x")).toBe("STRING");
    expect(inferColumnType({ nested: 1 })).toBe("VARIANT");
  });
});
