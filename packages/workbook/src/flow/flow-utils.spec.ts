import { describe, expect, it } from "vitest";

import type { RunnerCell } from "../cells";
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
  { id: "md", type: "markdown", isCollapsed: false, content: "x" },
  {
    id: "p",
    type: "protocol",
    isCollapsed: false,
    payload: { protocolId: "5f1f9c1a-2c1e-4f6a-9d1b-000000000001", version: 1 },
  },
  { id: "out", type: "output", isCollapsed: false, producedBy: "p" },
  { id: "c", type: "command", payload: { format: "string", content: "battery" } },
  {
    id: "a",
    type: "macro",
    isCollapsed: false,
    payload: { macroId: "5f1f9c1a-2c1e-4f6a-9d1b-000000000002", language: "javascript" },
  },
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

  it("goto targets must resolve to executable cells", () => {
    expect(resolveGotoCellId(cells, "c")).toBe("c");
    expect(resolveGotoCellId(cells, "out")).toBeNull();
    expect(resolveGotoCellId(cells, "ghost")).toBeNull();
  });

  it("the nearest upstream producer is a protocol or command, not a macro", () => {
    expect(nearestUpstreamProducerId(cells, "a")).toBe("c");
    expect(nearestUpstreamProducerId(cells, "c")).toBe("p");
    expect(nearestUpstreamProducerId(cells, "md")).toBeNull();
  });

  it("dispatch step ids derive from the macro cell id", () => {
    expect(dispatchStepId("a")).toBe("a__dispatch");
  });
});
