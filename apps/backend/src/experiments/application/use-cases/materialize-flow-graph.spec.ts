import { describe, expect, it } from "vitest";

import { assertFailure, assertSuccess } from "../../../common/utils/fp-utils";
import { materializeFlowGraph } from "./materialize-flow-graph";

describe("materializeFlowGraph", () => {
  it("materializes a valid workbook into a strict-valid flow graph", () => {
    const cells = [
      {
        id: "p1",
        type: "protocol",
        isCollapsed: false,
        payload: { protocolId: "11111111-1111-1111-1111-111111111111", version: 1 },
      },
      { id: "md1", type: "markdown", isCollapsed: false, content: "note" },
    ];
    const result = materializeFlowGraph(cells);
    assertSuccess(result);
    expect(result.value.kind).toBe("flow");
    if (result.value.kind === "flow") expect(result.value.graph.nodes.length).toBe(2);
  });

  it("represents an empty workbook as `none` (no flow)", () => {
    const result = materializeFlowGraph([]);
    assertSuccess(result);
    expect(result.value.kind).toBe("none");
  });

  it("fails closed (no graph) when duplicate cell ids yield duplicate node ids", () => {
    const cells = [
      { id: "dup", type: "markdown", isCollapsed: false, content: "a" },
      { id: "dup", type: "markdown", isCollapsed: false, content: "b" },
    ];
    const result = materializeFlowGraph(cells);
    assertFailure(result);
    expect(result.error.code).toBe("FLOW_MATERIALIZATION_FAILED");
  });

  it.each<[string, unknown]>([
    ["a non-array", { not: "an array" }],
    ["null", null],
    ["a string", "cells"],
    ["a command cell missing its payload", [{ id: "c1", type: "command", isCollapsed: false }]],
    [
      "a ref command with ref:null",
      [{ id: "c1", type: "command", isCollapsed: false, payload: { kind: "ref", ref: null } }],
    ],
    [
      "a mixed ref/static command payload",
      [
        {
          id: "c1",
          type: "command",
          isCollapsed: false,
          payload: {
            kind: "ref",
            ref: { sourceCellId: "m1", field: "f" },
            format: "string",
            content: "x",
          },
        },
      ],
    ],
    [
      "an invalid nested cell",
      [{ id: "p1", type: "protocol", isCollapsed: false, payload: { protocolId: "not-a-uuid" } }],
    ],
  ])("fails closed for malformed cells: %s", (_label, cells) => {
    const result = materializeFlowGraph(cells);
    assertFailure(result);
    expect(result.error.code).toBe("FLOW_MATERIALIZATION_FAILED");
  });
});
