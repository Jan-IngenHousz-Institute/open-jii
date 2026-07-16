import { describe, expect, it } from "vitest";

import type { ExperimentMetadata } from "@repo/api/domains/experiment/metadata/experiment-metadata.schema";

import type { MetadataFormValues } from "./form-helpers";
import { autoNameUntitled, toWirePayload } from "./form-helpers";

function makeRecord(name: string): ExperimentMetadata {
  return {
    metadataId: "00000000-0000-0000-0000-000000000000",
    experimentId: "11111111-1111-1111-1111-111111111111",
    metadata: { name },
    createdBy: "22222222-2222-2222-2222-222222222222",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

describe("autoNameUntitled", () => {
  it("returns the trimmed name when present", () => {
    expect(autoNameUntitled("  My map  ", [])).toBe("My map");
  });

  it("returns 'Untitled Metadata' when the name is blank and no untitled records exist", () => {
    expect(autoNameUntitled("", [])).toBe("Untitled Metadata");
    expect(autoNameUntitled("   ", [makeRecord("Plot map")])).toBe("Untitled Metadata");
  });

  it("increments the suffix when an Untitled record already exists", () => {
    expect(autoNameUntitled("", [makeRecord("Untitled Metadata")])).toBe("Untitled Metadata 2");
  });

  it("counts both 'Untitled Metadata' and 'Untitled Metadata N' as untitled", () => {
    const existing = [
      makeRecord("Untitled Metadata"),
      makeRecord("Untitled Metadata 2"),
      makeRecord("Plot map"),
    ];
    expect(autoNameUntitled("", existing)).toBe("Untitled Metadata 3");
  });

  it("ignores names that don't match the untitled pattern", () => {
    const existing = [makeRecord("Untitled Metadata Notes"), makeRecord("My data")];
    expect(autoNameUntitled("", existing)).toBe("Untitled Metadata");
  });
});

describe("toWirePayload", () => {
  const baseValues: MetadataFormValues = {
    name: "Plot map",
    columns: [
      { id: "col_0", name: "plot", type: "string" },
      { id: "col_1", name: "treatment", type: "string" },
    ],
    rows: [
      { _id: "row_0", col_0: "A1", col_1: "control" },
      { _id: "row_1", col_0: "B2", col_1: "treated" },
    ],
    identifierColumnId: "col_0",
    experimentQuestionId: "plot_id",
  };

  it("rewrites column ids to match column names", () => {
    const { metadata } = toWirePayload(baseValues, []);
    expect(metadata.columns).toEqual([
      { id: "plot", name: "plot", type: "string" },
      { id: "treatment", name: "treatment", type: "string" },
    ]);
  });

  it("remaps row keys from col_X to column names", () => {
    const { metadata } = toWirePayload(baseValues, []);
    expect(metadata.rows).toEqual([
      { _id: "row_0", plot: "A1", treatment: "control" },
      { _id: "row_1", plot: "B2", treatment: "treated" },
    ]);
  });

  it("translates identifierColumnId from col_X to the column name", () => {
    const { metadata } = toWirePayload(baseValues, []);
    expect(metadata.identifierColumnId).toBe("plot");
  });

  it("preserves experimentQuestionId verbatim", () => {
    const { metadata } = toWirePayload(baseValues, []);
    expect(metadata.experimentQuestionId).toBe("plot_id");
  });

  it("preserves _id and skips it from remapping", () => {
    const { metadata } = toWirePayload(baseValues, []);
    expect(metadata.rows[0]._id).toBe("row_0");
  });

  it("falls back to the literal identifierColumnId when it doesn't reference a column", () => {
    // Defensive path: the schema rejects this case at submit, but the helper
    // must not crash if called with an inconsistent form value.
    const orphan: MetadataFormValues = { ...baseValues, identifierColumnId: "col_missing" };
    const { metadata } = toWirePayload(orphan, []);
    expect(metadata.identifierColumnId).toBe("col_missing");
  });

  it("auto-fills the metadata name when blank", () => {
    const blank: MetadataFormValues = { ...baseValues, name: "" };
    const { metadata } = toWirePayload(blank, [makeRecord("Untitled Metadata")]);
    expect(metadata.name).toBe("Untitled Metadata 2");
  });

  it("leaves stray row keys (no matching column) unchanged", () => {
    // Rows can outlive a deleted column briefly; the helper passes through
    // whatever key the row carries instead of dropping data silently.
    const stray: MetadataFormValues = {
      ...baseValues,
      rows: [{ _id: "row_0", col_0: "A1", legacy_key: "kept" }],
    };
    const { metadata } = toWirePayload(stray, []);
    expect(metadata.rows[0]).toEqual({ _id: "row_0", plot: "A1", legacy_key: "kept" });
  });
});
