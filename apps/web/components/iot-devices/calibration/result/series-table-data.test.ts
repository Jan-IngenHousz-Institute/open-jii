import { describe, expect, it } from "vitest";

import { seriesTableData } from "./series-table-data";

describe("seriesTableData", () => {
  // The setpoint is what a reader scans down, so it leads whatever order the columns
  // arrived in.
  it("puts the setpoint first and keeps the rest as the procedure named them", () => {
    const { columns } = seriesTableData("par_sweep", [
      { par_raw: 208.4, stimulus: 0.8, par_ref: 200 },
    ]);

    expect(columns.map((column) => column.name)).toEqual(["stimulus", "par_raw", "par_ref"]);
  });

  // The shared table renders a cell by the type its column declares, so a reading has to
  // arrive under the type it actually is.
  it("types a column by the readings it holds", () => {
    const { columns } = seriesTableData("mixed", [
      {
        stimulus: 0.8,
        channels: [496, 352, 224],
        par: '{"par":160,"channels":[496,352]}',
        settings: "atime=200,astep=200",
        dark: true,
      },
    ]);

    const byName = new Map(columns.map((column) => [column.name, column.type_text]));
    expect(byName.get("stimulus")).toBe("DOUBLE");
    expect(byName.get("channels")).toBe("ARRAY<DOUBLE>");
    expect(byName.get("par")).toBe("STRUCT");
    expect(byName.get("settings")).toBe("STRING");
    // Nothing else renders a boolean, so it travels as the text it reads as.
    expect(byName.get("dark")).toBe("STRING");
  });

  // A device that answers a number at one setpoint and a structured reading at another
  // has no single cell that fits both.
  it("falls back to text for a column of mixed shapes", () => {
    const { columns, rows } = seriesTableData("par_sweep", [
      { par: 160 },
      { par: '{"par":160,"channels":[496]}' },
    ]);

    expect(columns[0].type_text).toBe("STRING");
    expect(rows[1].par).toBe('{"par":160,"channels":[496]}');
  });

  it("hands an object reading over as the JSON its cell parses", () => {
    const { rows } = seriesTableData("par_sweep", [{ stimulus: { current: 0.8, unit: "A" } }]);

    expect(rows[0].stimulus).toBe('{"current":0.8,"unit":"A"}');
  });

  it("keeps a numeric reading a number, so the cell can align it", () => {
    const { rows } = seriesTableData("par_sweep", [{ stimulus: 0.8, par_ref: 0 }]);

    expect(rows[0].stimulus).toBe(0.8);
    expect(rows[0].par_ref).toBe(0);
  });

  // The expandable cells key their open state by row, so every row needs its own id.
  it("gives each point an id of its own", () => {
    const { rows } = seriesTableData("par_sweep", [{ stimulus: 0.8 }, { stimulus: 2.4 }]);

    expect(rows.map((row) => row.id)).toEqual(["par_sweep:0", "par_sweep:1"]);
  });

  // A reading the procedure skipped leaves a hole rather than a zero.
  it("carries a missing reading as nothing at all", () => {
    const { rows } = seriesTableData("par_sweep", [{ stimulus: 0.8, par_ref: null }]);

    expect(rows[0].par_ref).toBeNull();
  });
});
