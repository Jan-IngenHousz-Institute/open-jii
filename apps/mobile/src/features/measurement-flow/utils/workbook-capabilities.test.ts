import { describe, expect, it } from "vitest";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";

import { guardMobileFlowContent, guardMobileWorkbookContent } from "./workbook-capabilities";

const cells: WorkbookCell[] = [
  {
    id: "parallel-1",
    type: "parallel",
    name: "device_lanes",
    isCollapsed: false,
    defaultLaneId: "lane-1",
    lanes: [
      {
        id: "lane-1",
        label: "Lane 1",
        color: "#005E5E",
        conditions: [],
        body: [{ id: "inside", type: "markdown", isCollapsed: false, content: "inside" }],
      },
    ],
  },
];

describe("mobile workbook capability guard", () => {
  it("accepts a cached container version under the mobile parallel capability", () => {
    expect(guardMobileWorkbookContent({ id: "cached", cells }).cells).toBe(cells);
  });

  it("accepts a projected flow graph containing a container node", () => {
    expect(
      guardMobileFlowContent({
        graph: {
          nodes: [
            {
              id: "parallel-1",
              type: "parallel",
              name: "device_lanes",
              isStart: true,
              content: {
                name: "device_lanes",
                defaultLaneId: "lane-1",
                lanes: (cells[0] as Extract<WorkbookCell, { type: "parallel" }>).lanes,
              },
            },
          ],
          edges: [],
        },
      }).graph.nodes[0]?.type,
    ).toBe("parallel");
  });
});
