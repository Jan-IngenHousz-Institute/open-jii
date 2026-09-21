import { describe, expect, it } from "vitest";

import { columnForRead, isDefaultColumn } from "./read-columns";
import type { ReadSource } from "./rig-sources";

const SOURCES: ReadSource[] = [
  { role: "dut", offered: ["par_raw", "spec", "baseline,0"], isExhaustive: false },
  { role: "par_ref", offered: ["par", "par_raw"], isExhaustive: true },
];

describe("columnForRead", () => {
  // A bench instrument is named for the job it does, which is what the script wants to
  // index by; two references reading "par" would otherwise both want the same column.
  it("names a bench instrument's reading after its role", () => {
    expect(columnForRead({ instrument: "par_ref", command: "par", as: "" }, SOURCES)).toBe(
      "par_ref",
    );
  });

  // A device answers many things, so the command is what tells its readings apart.
  it("names a device's reading after the command", () => {
    expect(columnForRead({ instrument: "dut", command: "par_raw", as: "" }, SOURCES)).toBe(
      "par_raw",
    );
  });

  it("makes a column name out of a command that is not one", () => {
    expect(columnForRead({ instrument: "dut", command: "baseline,0", as: "" }, SOURCES)).toBe(
      "baseline_0",
    );
    expect(columnForRead({ instrument: "dut", command: "  ", as: "" }, SOURCES)).toBe("value");
  });

  it("calls what the operator types the reference", () => {
    expect(columnForRead({ operator: "Read the meter", as: "", type: "number" }, SOURCES)).toBe(
      "reference",
    );
  });
});

describe("isDefaultColumn", () => {
  it("knows the name the reading gave itself, numbered or not", () => {
    expect(isDefaultColumn({ instrument: "dut", command: "par_raw", as: "par_raw" }, SOURCES)).toBe(
      true,
    );
    expect(
      isDefaultColumn({ instrument: "dut", command: "par_raw", as: "par_raw_2" }, SOURCES),
    ).toBe(true);
  });

  it("leaves a name the author chose alone", () => {
    expect(isDefaultColumn({ instrument: "dut", command: "get_par", as: "par" }, SOURCES)).toBe(
      false,
    );
  });
});
