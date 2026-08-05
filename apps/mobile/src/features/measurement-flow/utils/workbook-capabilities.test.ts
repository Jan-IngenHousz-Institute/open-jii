import { describe, expect, it } from "vitest";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";

import {
  guardMobileFlowContent,
  guardMobileWorkbookContent,
  hasUnsupportedMobileWorkbookContent,
} from "./workbook-capabilities";

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
  it("rejects a cached container version before it can be converted or executed", () => {
    expect(() => guardMobileWorkbookContent({ id: "cached", cells })).toThrow(
      "workbook-parallel-v1",
    );
  });

  it("rejects a cached legacy flow graph containing a container node", () => {
    expect(() =>
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
      }),
    ).toThrow("workbook-parallel-v1");
  });

  it("detects unsupported persisted cells or projected nodes during rehydration", () => {
    expect(hasUnsupportedMobileWorkbookContent({ cells, flowNodes: [] })).toBe(true);
    expect(
      hasUnsupportedMobileWorkbookContent({ cells: [], flowNodes: [{ type: "parallel" }] }),
    ).toBe(true);
    expect(
      hasUnsupportedMobileWorkbookContent({ cells: [], flowNodes: [{ type: "measurement" }] }),
    ).toBe(false);
  });
});
