import { describe, expect, it } from "vitest";

import type { WorkbookCell } from "../domains/workbook/workbook-cells.schema";
import { findOutputCellByProducer } from "./output-lookup";

function output(id: string, producedBy: string): WorkbookCell {
  return { id, type: "output", isCollapsed: false, producedBy };
}

describe("findOutputCellByProducer", () => {
  it("uses producedBy ownership rather than output id or adjacency", () => {
    const cells: WorkbookCell[] = [
      output("source-id", "another-source"),
      { id: "note", type: "markdown", isCollapsed: false, content: "between" },
      output("unrelated-id", "source-id"),
    ];

    expect(findOutputCellByProducer(cells, "source-id")).toEqual({
      ok: true,
      outputCell: cells[2],
    });
  });

  it("returns a successful absence when no display output exists", () => {
    expect(findOutputCellByProducer([], "source-id")).toEqual({
      ok: true,
      outputCell: undefined,
    });
  });

  it("fails deterministically for duplicate producer outputs", () => {
    expect(
      findOutputCellByProducer(
        [output("out-1", "source-id"), output("out-2", "source-id")],
        "source-id",
      ),
    ).toEqual({
      ok: false,
      error: {
        code: "COMMAND_OUTPUT_DUPLICATE",
        sourceCellId: "source-id",
        outputCellIds: ["out-1", "out-2"],
      },
    });
  });
});
