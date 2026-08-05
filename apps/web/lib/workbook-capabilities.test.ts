import { describe, expect, it } from "vitest";

import { WORKBOOK_PARALLEL_CAPABILITY } from "@repo/api/domains/workbook/workbook-capabilities";
import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";

import { guardWebWorkbookContent, WEB_WORKBOOK_CAPABILITIES } from "./workbook-capabilities";

describe("web workbook capability guard", () => {
  it("declares and accepts the parallel capability for cached design content", () => {
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
    const version = { id: "cached", cells };

    expect(WEB_WORKBOOK_CAPABILITIES).toContain(WORKBOOK_PARALLEL_CAPABILITY);
    expect(guardWebWorkbookContent(version)).toBe(version);
  });
});
