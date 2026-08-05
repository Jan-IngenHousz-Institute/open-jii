import { describe, expect, it } from "vitest";

import type { WorkbookCell } from "../domains/workbook/workbook-cells.schema";
import {
  branchTargetCells,
  findWorkbookCell,
  mapWorkbookCellTree,
  resolveCellScope,
  walkWorkbookCells,
} from "./workbook-cell-tree";

const cells: WorkbookCell[] = [
  { id: "root-before", type: "markdown", isCollapsed: false, content: "before" },
  {
    id: "container",
    type: "parallel",
    isCollapsed: false,
    name: "lanes",
    defaultLaneId: "lane-b",
    lanes: [
      {
        id: "lane-a",
        label: "A",
        color: "#111111",
        conditions: [],
        body: [
          { id: "a-before", type: "markdown", isCollapsed: false, content: "a" },
          {
            id: "a-branch",
            type: "branch",
            isCollapsed: false,
            paths: [{ id: "p", label: "p", color: "#111111", conditions: [] }],
          },
          { id: "a-after", type: "markdown", isCollapsed: false, content: "later" },
        ],
      },
      {
        id: "lane-b",
        label: "B",
        color: "#222222",
        conditions: [],
        body: [{ id: "b-only", type: "markdown", isCollapsed: false, content: "b" }],
      },
    ],
  },
  { id: "root-after", type: "markdown", isCollapsed: false, content: "after" },
];

describe("workbook cell tree", () => {
  it("walks the whole shallow tree in deterministic pre-order", () => {
    expect(walkWorkbookCells(cells).map(({ cell }) => cell.id)).toEqual([
      "root-before",
      "container",
      "a-before",
      "a-branch",
      "a-after",
      "b-only",
      "root-after",
    ]);
    expect(findWorkbookCell(cells, "b-only")?.path).toEqual([
      { containerCellId: "container", laneId: "lane-b" },
    ]);
  });

  it("resolves ancestor and same-lane predecessors but excludes siblings and later cells", () => {
    const scope = resolveCellScope(cells, {
      path: [{ containerCellId: "container", laneId: "lane-a" }],
      cellId: "a-branch",
    });
    expect(scope.map(({ cell }) => cell.id)).toEqual(["root-before", "a-before"]);
  });

  it("limits branch targets to the branch's own body", () => {
    expect(
      branchTargetCells(cells, {
        path: [{ containerCellId: "container", laneId: "lane-a" }],
        cellId: "a-branch",
      }).map((cell) => cell.id),
    ).toEqual(["a-before", "a-after"]);
  });

  it("keeps post-container root scope shallow", () => {
    expect(
      resolveCellScope(cells, { path: [], cellId: "root-after" }).map(({ cell }) => cell.id),
    ).toEqual(["root-before", "container"]);
  });

  it("fails closed on duplicate ids unless validation explicitly requests diagnostics", () => {
    const duplicate = [
      ...cells,
      { id: "b-only", type: "markdown", isCollapsed: false, content: "duplicate" },
    ] satisfies WorkbookCell[];

    expect(() => walkWorkbookCells(duplicate)).toThrow(/Duplicate workbook cell id "b-only"/);
    expect(() => findWorkbookCell(duplicate, "root-before")).toThrow(/Duplicate workbook cell id/);
    expect(walkWorkbookCells(duplicate, { allowDuplicateIds: true })).toHaveLength(8);
  });

  it("filters matching cells recursively without flattening lane bodies", () => {
    const withOutput = structuredClone(cells);
    const container = withOutput[1];
    if (container.type !== "parallel") throw new Error("expected parallel fixture");
    container.lanes[0].body.push({
      id: "nested-output",
      type: "output",
      isCollapsed: false,
      producedBy: "a-before",
    });

    const filtered = mapWorkbookCellTree(withOutput, ({ cell }) =>
      cell.type === "output" ? null : cell,
    );
    const filteredContainer = filtered[1];
    if (filteredContainer.type !== "parallel") throw new Error("expected parallel result");
    expect(filteredContainer.lanes[0].body.map((cell) => cell.id)).toEqual([
      "a-before",
      "a-branch",
      "a-after",
    ]);
    expect(filtered.map((cell) => cell.id)).toEqual(["root-before", "container", "root-after"]);
  });
});
