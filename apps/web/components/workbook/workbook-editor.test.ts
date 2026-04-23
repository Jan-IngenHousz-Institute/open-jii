import { describe, it, expect } from "vitest";

import { createDefaultCell } from "./workbook-editor";

describe("createDefaultCell", () => {
  it("creates a markdown cell with empty content", () => {
    const cell = createDefaultCell("markdown");
    expect(cell.type).toBe("markdown");
    expect(cell).toMatchObject({
      type: "markdown",
      content: "",
      isCollapsed: false,
    });
    expect(cell.id).toBeDefined();
  });

  it("creates a question cell with open_ended default", () => {
    const cell = createDefaultCell("question");
    expect(cell.type).toBe("question");
    expect(cell).toMatchObject({
      type: "question",
      isCollapsed: false,
      question: { kind: "open_ended", text: "", required: false },
    });
  });

  it("creates an output cell with empty producedBy", () => {
    const cell = createDefaultCell("output");
    expect(cell.type).toBe("output");
    expect(cell).toMatchObject({
      type: "output",
      producedBy: "",
      isCollapsed: false,
    });
  });

  it("creates a branch cell with one default path and condition", () => {
    const cell = createDefaultCell("branch");
    expect(cell.type).toBe("branch");
    if (cell.type !== "branch") throw new Error("unexpected");
    expect(cell.paths).toHaveLength(1);
    expect(cell.paths[0].label).toBe("Path 1");
    expect(cell.paths[0].conditions).toHaveLength(1);
    expect(cell.paths[0].conditions[0]).toMatchObject({
      sourceCellId: "",
      field: "",
      operator: "eq",
      value: "",
    });
  });

  it("generates unique IDs for each cell", () => {
    const a = createDefaultCell("markdown");
    const b = createDefaultCell("markdown");
    expect(a.id).not.toBe(b.id);
  });

  it("throws for protocol type", () => {
    expect(() => createDefaultCell("protocol")).toThrow(
      "Protocol cells must be created via the protocol picker",
    );
  });

  it("throws for macro type", () => {
    expect(() => createDefaultCell("macro")).toThrow(
      "Macro cells must be created via the macro picker",
    );
  });
});
