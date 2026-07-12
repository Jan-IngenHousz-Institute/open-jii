import { describe, it, expect } from "vitest";

import type { WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";

import { diffCells } from "./workbook-diff";

const protocol = (id: string, name = "P"): WorkbookCell => ({
  id,
  type: "protocol",
  isCollapsed: false,
  payload: { protocolId: `${id}-prot`, version: 1, name },
});

const question = (id: string, name: string): WorkbookCell => ({
  id,
  type: "question",
  isCollapsed: false,
  isAnswered: false,
  name,
  question: { kind: "open_ended", text: "?", required: false },
});

const output = (id: string, producedBy: string): WorkbookCell => ({
  id,
  type: "output",
  isCollapsed: false,
  producedBy,
  data: { v: 1 },
});

describe("diffCells", () => {
  it("returns no changes for identical designs", () => {
    const cells = [protocol("p1"), question("q1", "reading")];
    expect(diffCells(cells, cells)).toEqual([]);
  });

  it("detects added and removed cells", () => {
    const before = [protocol("p1")];
    const after = [protocol("p1"), question("q1", "reading")];
    expect(diffCells(before, after)).toContainEqual(
      expect.objectContaining({ type: "added", cellId: "q1" }),
    );
    expect(diffCells(after, before)).toContainEqual(
      expect.objectContaining({ type: "removed", cellId: "q1" }),
    );
  });

  it("detects an edited cell payload", () => {
    const before = [protocol("p1", "Old name")];
    const after = [protocol("p1", "New name")];
    expect(diffCells(before, after)).toEqual([
      expect.objectContaining({ type: "changed", cellId: "p1" }),
    ]);
  });

  it("reports a changed markdown cell with no label", () => {
    const markdown = (id: string, content: string): WorkbookCell => ({
      id,
      type: "markdown",
      isCollapsed: false,
      content,
    });
    const changes = diffCells([markdown("m1", "before")], [markdown("m1", "after")]);
    expect(changes).toEqual([
      expect.objectContaining({ type: "changed", cellId: "m1", cellType: "markdown" }),
    ]);
    expect(changes[0].label).toBeUndefined();
  });

  it("ignores runtime fields and output cells (a re-run is not a change)", () => {
    const before = [protocol("p1"), question("q1", "reading")];
    const answered: WorkbookCell = {
      id: "q1",
      type: "question",
      isCollapsed: false,
      isAnswered: true,
      answer: "42",
      name: "reading",
      question: { kind: "open_ended", text: "?", required: false },
    };
    const afterRun: WorkbookCell[] = [protocol("p1"), answered, output("out1", "p1")];
    expect(diffCells(before, afterRun)).toEqual([]);
  });

  it("detects a reordered cell", () => {
    const before = [protocol("p1"), question("q1", "reading"), protocol("p2")];
    const after = [question("q1", "reading"), protocol("p1"), protocol("p2")];
    const changes = diffCells(before, after);
    expect(changes.some((c) => c.type === "moved")).toBe(true);
    expect(changes.every((c) => c.type === "moved")).toBe(true);
  });
});
