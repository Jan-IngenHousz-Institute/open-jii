import { describe, expect, it } from "vitest";

import { datasetLabel } from "./dataset-label";

function table(tableType: "static" | "macro" | "upload", displayName: string) {
  return {
    identifier: "id",
    tableType,
    displayName,
    totalRows: 0,
    latestRowAt: null,
    schemaRevision: null,
  };
}

describe("datasetLabel", () => {
  it("unwraps a macro table down to its own name", () => {
    expect(datasetLabel(table("macro", "Processed Data (Chlorophyll fit)"))).toBe(
      "Chlorophyll fit",
    );
  });

  it("leaves static and uploaded tables as they are named", () => {
    expect(datasetLabel(table("static", "Raw Data"))).toBe("Raw Data");
    expect(datasetLabel(table("upload", "field-notes-sept"))).toBe("field-notes-sept");
  });

  it("keeps the whole name when the wrapper is missing or empty", () => {
    expect(datasetLabel(table("macro", "Chlorophyll fit"))).toBe("Chlorophyll fit");
    expect(datasetLabel(table("macro", "Processed Data ()"))).toBe("Processed Data ()");
  });

  it("falls back to the whole name rather than guessing at nested brackets", () => {
    expect(datasetLabel(table("macro", "Processed Data (NDVI (red edge))"))).toBe(
      "Processed Data (NDVI (red edge))",
    );
  });
});
