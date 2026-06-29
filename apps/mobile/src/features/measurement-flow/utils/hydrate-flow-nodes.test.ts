import { describe, expect, it } from "vitest";

import type { WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";
import type { EntitySnapshots } from "@repo/api/schemas/workbook-version.schema";

import type { FlowNode } from "../screens/measurement-flow-screen/types";
import { deriveMacroFilename } from "./derive-macro-filename";
import { hydrateFlowNodes } from "./hydrate-flow-nodes";

const cells: WorkbookCell[] = [
  {
    id: "c1",
    type: "protocol",
    isCollapsed: false,
    payload: { protocolId: "p1", version: 1, name: "My Protocol" },
  },
  {
    id: "c2",
    type: "macro",
    isCollapsed: false,
    payload: { macroId: "m1", language: "python", name: "My Macro" },
  },
];

const snapshots: EntitySnapshots = {
  protocols: { p1: { code: [{ x: 1 }], family: "multispeq" } },
  macros: { m1: { code: "print(1)" } },
};

const nodes: FlowNode[] = [
  {
    id: "n1",
    name: "n1",
    type: "measurement",
    isStart: false,
    content: { params: {}, protocolId: "p1" },
  },
  {
    id: "n2",
    name: "n2",
    type: "analysis",
    isStart: false,
    content: { params: {}, macroId: "m1" },
  },
  { id: "n3", name: "n3", type: "question", isStart: false, content: { kind: "text" } },
];

describe("hydrateFlowNodes", () => {
  it("attaches protocol code (snapshot) + name (cell) to measurement nodes", () => {
    const [measurement] = hydrateFlowNodes(nodes, cells, snapshots);
    expect(measurement.content.protocol).toEqual({
      code: [{ x: 1 }],
      family: "multispeq",
      name: "My Protocol",
    });
  });

  it("builds macro {id, name, derived filename, language, code} for analysis nodes", () => {
    const macroNode = hydrateFlowNodes(nodes, cells, snapshots)[1];
    expect(macroNode.content.macro).toEqual({
      id: "m1",
      name: "My Macro",
      filename: deriveMacroFilename("m1"),
      language: "python",
      code: "print(1)",
    });
  });

  it("leaves non-measurement/analysis nodes untouched", () => {
    const questionNode = hydrateFlowNodes(nodes, cells, snapshots)[2];
    expect(questionNode).toEqual(nodes[2]);
  });

  it("falls back to empty code / filename name when the snapshot or cell name is missing", () => {
    const bareNodes: FlowNode[] = [
      {
        id: "n1",
        name: "n1",
        type: "measurement",
        isStart: false,
        content: { params: {}, protocolId: "px" },
      },
      {
        id: "n2",
        name: "n2",
        type: "analysis",
        isStart: false,
        content: { params: {}, macroId: "mx" },
      },
    ];
    const [m, a] = hydrateFlowNodes(bareNodes, [], { protocols: {}, macros: {} });
    expect(m.content.protocol).toEqual({ code: [], family: undefined, name: undefined });
    expect(a.content.macro).toEqual({
      id: "mx",
      name: deriveMacroFilename("mx"),
      filename: deriveMacroFilename("mx"),
      language: "",
      code: "",
    });
  });
});
