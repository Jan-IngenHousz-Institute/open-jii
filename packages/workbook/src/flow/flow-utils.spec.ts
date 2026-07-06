import { describe, expect, it } from "vitest";

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
});
