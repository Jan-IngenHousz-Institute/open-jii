import { describe, expect, it } from "vitest";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { WellKnownColumnTypes } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { filterColumnPathFor, parentColumnName } from "./filter-column-path";

const stringColumn: ExperimentDataColumn = {
  name: "label",
  type_name: "STRING",
  type_text: "STRING",
};

const contributorColumn: ExperimentDataColumn = {
  name: "owner",
  type_name: "STRUCT",
  type_text: WellKnownColumnTypes.CONTRIBUTOR,
};

const deviceColumn: ExperimentDataColumn = {
  name: "device",
  type_name: "STRUCT",
  type_text: WellKnownColumnTypes.DEVICE,
};

describe("filterColumnPathFor", () => {
  it("returns the bare column name for scalar columns", () => {
    expect(filterColumnPathFor(stringColumn)).toBe("label");
  });

  it("routes CONTRIBUTOR structs through their identity sub-field", () => {
    expect(filterColumnPathFor(contributorColumn)).toBe("owner.id");
  });

  it("routes DEVICE structs through their serial-number sub-field", () => {
    expect(filterColumnPathFor(deviceColumn)).toBe("device.serial_number");
  });
});

describe("parentColumnName", () => {
  it("returns the parent for dotted struct paths", () => {
    expect(parentColumnName("owner.id")).toBe("owner");
    expect(parentColumnName("a.b.c")).toBe("a");
  });

  it("returns the input unchanged for bare names", () => {
    expect(parentColumnName("label")).toBe("label");
    expect(parentColumnName("")).toBe("");
  });
});
