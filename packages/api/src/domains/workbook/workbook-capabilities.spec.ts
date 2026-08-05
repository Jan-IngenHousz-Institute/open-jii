import { describe, expect, it } from "vitest";

import type { ExperimentFlowGraph } from "../experiment/experiment.schema";
import {
  assertContainerFreeFlowGraph,
  assertContainerFreeWorkbookCells,
  assertFlowGraphSupported,
  assertWorkbookCellsSupported,
  parseWorkbookCapabilities,
  UnsupportedWorkbookCapabilityError,
  WORKBOOK_PARALLEL_CAPABILITY,
} from "./workbook-capabilities";
import type { WorkbookCell } from "./workbook-cells.schema";

const container: Extract<WorkbookCell, { type: "parallel" }> = {
  id: "parallel-1",
  type: "parallel",
  name: "device_lanes",
  defaultLaneId: "lane-1",
  isCollapsed: false,
  lanes: [
    {
      id: "lane-1",
      label: "Lane 1",
      color: "#005E5E",
      conditions: [],
      body: [{ id: "inside", type: "markdown", isCollapsed: false, content: "inside" }],
    },
  ],
};

const graph: ExperimentFlowGraph = {
  nodes: [
    {
      id: "parallel-1",
      type: "parallel",
      name: "device_lanes",
      isStart: true,
      position: { x: 0, y: 0 },
      content: {
        name: container.name,
        defaultLaneId: container.defaultLaneId,
        lanes: container.lanes,
      },
    },
  ],
  edges: [],
};

describe("workbook content capabilities", () => {
  it("parses repeatable comma-separated capability headers", () => {
    expect(parseWorkbookCapabilities(["other, workbook-parallel-v1", "third"])).toEqual(
      new Set(["other", "workbook-parallel-v1", "third"]),
    );
  });

  it("fails closed for container cells unless the parallel token is present", () => {
    expect(() => assertWorkbookCellsSupported([container], new Set())).toThrow(
      UnsupportedWorkbookCapabilityError,
    );
    expect(() =>
      assertWorkbookCellsSupported([container], new Set([WORKBOOK_PARALLEL_CAPABILITY])),
    ).not.toThrow();
  });

  it("fails closed for projected container graphs and accepts the declared token", () => {
    expect(() => assertFlowGraphSupported(graph, new Set())).toThrow(
      UnsupportedWorkbookCapabilityError,
    );
    expect(() =>
      assertFlowGraphSupported(graph, new Set([WORKBOOK_PARALLEL_CAPABILITY])),
    ).not.toThrow();
  });

  it("provides explicit container-free guards for cached and offline clients", () => {
    expect(() => assertContainerFreeWorkbookCells([container])).toThrow(
      UnsupportedWorkbookCapabilityError,
    );
    expect(() => assertContainerFreeFlowGraph(graph)).toThrow(UnsupportedWorkbookCapabilityError);
  });
});
