import { describe, expect, it } from "vitest";

import {
  makeCustomMetadataFormSchema,
  zExperimentCustomMetadataPayload,
} from "./experiment-metadata.schema";

describe("zExperimentCustomMetadataPayload", () => {
  const validBlob = {
    name: "Plot map",
    columns: [
      { id: "plot", name: "plot", type: "string" as const },
      { id: "treatment", name: "treatment", type: "string" as const },
    ],
    rows: [{ _id: "row_1", plot: "A1", treatment: "control" }],
    identifierColumnId: "plot",
    experimentQuestionId: "plot_id",
  };

  it("accepts a well-formed payload", () => {
    expect(zExperimentCustomMetadataPayload.parse(validBlob)).toEqual(validBlob);
  });

  it("rejects empty/whitespace column names", () => {
    const blob = {
      ...validBlob,
      columns: [{ id: "x", name: "   ", type: "string" as const }],
      identifierColumnId: "   ",
    };
    const result = zExperimentCustomMetadataPayload.safeParse(blob);
    expect(result.success).toBe(false);
  });

  it("rejects duplicate column names within the blob", () => {
    const blob = {
      ...validBlob,
      columns: [
        { id: "plot", name: "plot", type: "string" as const },
        { id: "plot2", name: "plot", type: "string" as const },
      ],
    };
    const result = zExperimentCustomMetadataPayload.safeParse(blob);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join(".") === "columns.1.name");
      expect(issue?.message.toLowerCase()).toContain("duplicated");
    }
  });

  it("rejects column names that collide with reserved system columns", () => {
    const blob = {
      ...validBlob,
      columns: [{ id: "device_id", name: "device_id", type: "string" as const }],
      rows: [{ _id: "row_1", device_id: "X" }],
      identifierColumnId: "device_id",
    };
    const result = zExperimentCustomMetadataPayload.safeParse(blob);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join(".") === "columns.0.name");
      expect(issue?.message.toLowerCase()).toContain("reserved");
    }
  });

  it("rejects identifierColumnId that is not in columns", () => {
    const blob = { ...validBlob, identifierColumnId: "missing" };
    const result = zExperimentCustomMetadataPayload.safeParse(blob);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join(".") === "identifierColumnId");
      expect(issue?.message).toContain("missing");
    }
  });

  it("requires at least one column", () => {
    const blob = { ...validBlob, columns: [] };
    expect(zExperimentCustomMetadataPayload.safeParse(blob).success).toBe(false);
  });

  it.each([
    ["space", "plot id"],
    ["hyphen", "plot-id"],
    ["dot", "plot.id"],
    ["slash", "plot/id"],
    ["punctuation", "plot!"],
  ])("rejects column name with %s (%s)", (_label, name) => {
    const blob = {
      ...validBlob,
      columns: [{ id: "plot", name, type: "string" as const }],
      rows: [{ _id: "row_1", plot: "A1" }],
      identifierColumnId: "plot",
    };
    const result = zExperimentCustomMetadataPayload.safeParse(blob);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join(".") === "columns.0.name");
      expect(issue?.message.toLowerCase()).toContain("letters");
    }
  });

  it.each([
    ["lowercase", "plot"],
    ["uppercase", "Plot"],
    ["mixed case", "PlotId"],
    ["with underscore", "plot_id"],
    ["with digits", "plot_2024"],
    ["leading digit", "2024_yield"],
    ["leading underscore", "_internal"],
  ])("accepts column name (%s)", (_label, name) => {
    const blob = {
      ...validBlob,
      columns: [{ id: "x", name, type: "string" as const }],
      rows: [{ _id: "row_1", x: "v" }],
      identifierColumnId: "x",
    };
    expect(zExperimentCustomMetadataPayload.safeParse(blob).success).toBe(true);
  });
});

describe("makeCustomMetadataFormSchema (flow collision)", () => {
  const baseBlob = {
    name: "Plot map",
    columns: [
      { id: "plot", name: "plot", type: "string" as const },
      { id: "yield", name: "yield", type: "number" as const },
    ],
    rows: [{ _id: "row_1", plot: "A1", yield: 12 }],
    identifierColumnId: "plot",
    experimentQuestionId: "plot_id",
  };

  it("rejects a non-identifier column whose name matches a sanitized question label", () => {
    const schema = makeCustomMetadataFormSchema(new Set(["yield", "moisture"]));
    const result = schema.safeParse(baseBlob);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join(".") === "columns.1.name");
      expect(issue?.message.toLowerCase()).toContain("question");
    }
  });

  it("exempts the identifier column from the question-label collision rule", () => {
    // identifierColumnId is "plot" and "plot" is also a question label;
    // pipeline filters it out before it reaches gold, so allow it.
    const schema = makeCustomMetadataFormSchema(new Set(["plot"]));
    expect(schema.safeParse(baseBlob).success).toBe(true);
  });

  it("accepts blobs whose columns don't collide with question labels", () => {
    const schema = makeCustomMetadataFormSchema(new Set(["moisture", "temperature"]));
    expect(schema.safeParse(baseBlob).success).toBe(true);
  });

  it("still applies the base zExperimentCustomMetadataPayload rules", () => {
    const schema = makeCustomMetadataFormSchema(new Set());
    const blob = {
      ...baseBlob,
      columns: [{ id: "device_id", name: "device_id", type: "string" as const }],
      rows: [{ _id: "row_1", device_id: "x" }],
      identifierColumnId: "device_id",
    };
    const result = schema.safeParse(blob);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join(".") === "columns.0.name");
      expect(issue?.message.toLowerCase()).toContain("reserved");
    }
  });

  it("with empty reserved set behaves identically to the base schema", () => {
    const schema = makeCustomMetadataFormSchema(new Set());
    expect(schema.safeParse(baseBlob).success).toBe(true);
  });
});
