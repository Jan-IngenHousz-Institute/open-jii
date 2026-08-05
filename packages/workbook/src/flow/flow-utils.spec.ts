import { describe, expect, it } from "vitest";

import type { ParallelBodyCell } from "@repo/api/domains/workbook/workbook-cells.schema";

import type { RunnerCell } from "../cells";
import { commandCell, macroCell, markdownCell, protocolCell } from "../demo/fixtures";
import {
  dispatchStepId,
  executableCells,
  firstExecutableCellId,
  isExecutable,
  isProducer,
  nearestUpstreamProducerId,
  nextCellId,
  prevCellId,
  resolveGotoCellId,
} from "./flow-utils";

const cells: RunnerCell[] = [
  markdownCell("md"),
  protocolCell("p"),
  { id: "out", type: "output", isCollapsed: false, producedBy: "p" },
  commandCell("c"),
  macroCell("a"),
];

function bodyCell(cell: RunnerCell): ParallelBodyCell {
  if (cell.type === "parallel") throw new Error("nested container");
  return cell;
}

describe("flow-utils", () => {
  it("command cells are executable producers; output cells are neither", () => {
    expect(executableCells(cells).map((c) => c.id)).toEqual(["md", "p", "c", "a"]);
    expect(isExecutable(cells[2])).toBe(false);
    expect(isProducer(cells[3])).toBe(true);
    expect(isProducer(cells[0])).toBe(false);
  });

  it("next/prev walk executable order, skipping output cells", () => {
    expect(firstExecutableCellId(cells)).toBe("md");
    expect(nextCellId(cells, "p")).toBe("c");
    expect(nextCellId(cells, "a")).toBeNull();
    expect(prevCellId(cells, "c")).toBe("p");
    expect(prevCellId(cells, "md")).toBeNull();
  });

  it("goto targets must resolve to executable cells; dispatch ids derive from the macro", () => {
    expect(resolveGotoCellId(cells, "c")).toBe("c");
    expect(resolveGotoCellId(cells, "out")).toBeNull();
    expect(resolveGotoCellId(cells, "ghost")).toBeNull();
    expect(dispatchStepId("a")).toBe("a__dispatch");
  });

  it("the nearest upstream producer is a protocol or command, not a macro", () => {
    expect(nearestUpstreamProducerId(cells, "a")).toBe("c");
    expect(nearestUpstreamProducerId(cells, "c")).toBe("p");
    expect(nearestUpstreamProducerId(cells, "md")).toBeNull();
  });

  it("keeps navigation and upstream resolution inside a lane body", () => {
    const tree: RunnerCell[] = [
      commandCell("root"),
      {
        id: "parallel",
        type: "parallel",
        isCollapsed: false,
        name: "lanes",
        defaultLaneId: "b",
        lanes: [
          {
            id: "a",
            label: "A",
            color: "#111111",
            conditions: [],
            body: [bodyCell(commandCell("a1")), bodyCell(macroCell("a2"))],
          },
          {
            id: "b",
            label: "B",
            color: "#222222",
            conditions: [],
            body: [bodyCell(commandCell("b1")), bodyCell(macroCell("b2"))],
          },
        ],
      },
      commandCell("after"),
    ];

    expect(nextCellId(tree, "a1")).toBe("a2");
    expect(nextCellId(tree, "a2")).toBeNull();
    expect(prevCellId(tree, "b1")).toBeNull();
    expect(nearestUpstreamProducerId(tree, "a2")).toBe("a1");
    expect(nearestUpstreamProducerId(tree, "b2")).toBe("b1");
    expect(resolveGotoCellId(tree, "b1", "a2")).toBeNull();
  });
});
