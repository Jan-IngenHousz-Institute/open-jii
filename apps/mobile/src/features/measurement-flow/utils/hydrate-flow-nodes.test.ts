import { describe, expect, it } from "vitest";
import type { FlowNode } from "~/shared/measurements/flow-node";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import type { EntitySnapshots } from "@repo/api/domains/workbook/workbook-version.schema";

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
    id: "c1",
    name: "n1",
    type: "measurement",
    isStart: false,
    content: { params: {}, protocolId: "p1" },
  },
  {
    id: "c2",
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

  it("preserves a non-array protocol document for execution-time narrowing", () => {
    const stringSnapshots: EntitySnapshots = {
      protocols: { p1: { code: "device-defined source", family: "generic" } },
      macros: {},
    };

    const [measurement] = hydrateFlowNodes(nodes, cells, stringSnapshots);

    expect(measurement.content.protocol).toEqual({
      code: "device-defined source",
      family: "generic",
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

  it("hydrates repeated protocol references from their exact workbook cells", () => {
    const repeatedCells: WorkbookCell[] = [
      {
        id: "ground-cell",
        type: "protocol",
        isCollapsed: false,
        payload: { protocolId: "p1", version: 1, name: "Ground position" },
      },
      {
        id: "ambit-cell",
        type: "protocol",
        isCollapsed: false,
        payload: { protocolId: "p1", version: 1, name: "Ambit 2 position" },
      },
    ];
    const repeatedNodes: FlowNode[] = [
      {
        id: "ground-cell",
        name: "Ground position",
        type: "measurement",
        isStart: false,
        content: { params: {}, protocolId: "p1" },
      },
      {
        id: "ambit-cell",
        name: "Ambit 2 position",
        type: "measurement",
        isStart: false,
        content: { params: {}, protocolId: "p1" },
      },
    ];

    const hydrated = hydrateFlowNodes(repeatedNodes, repeatedCells, snapshots);

    expect(hydrated.map((node) => node.content.protocol?.name)).toEqual([
      "Ground position",
      "Ambit 2 position",
    ]);
  });

  it("hydrates repeated macro references from their exact workbook cells", () => {
    const repeatedCells: WorkbookCell[] = [
      {
        id: "ground-macro-cell",
        type: "macro",
        isCollapsed: false,
        payload: { macroId: "m1", language: "python", name: "Ground analysis" },
      },
      {
        id: "ambit-macro-cell",
        type: "macro",
        isCollapsed: false,
        payload: { macroId: "m1", language: "javascript", name: "Ambit 2 analysis" },
      },
    ];
    const repeatedNodes: FlowNode[] = [
      {
        id: "ground-macro-cell",
        name: "Ground analysis",
        type: "analysis",
        isStart: false,
        content: { params: {}, macroId: "m1" },
      },
      {
        id: "ambit-macro-cell",
        name: "Ambit 2 analysis",
        type: "analysis",
        isStart: false,
        content: { params: {}, macroId: "m1" },
      },
    ];

    const hydrated = hydrateFlowNodes(repeatedNodes, repeatedCells, snapshots);

    expect(
      hydrated.map((node) => ({
        name: node.content.macro?.name,
        language: node.content.macro?.language,
      })),
    ).toEqual([
      { name: "Ground analysis", language: "python" },
      { name: "Ambit 2 analysis", language: "javascript" },
    ]);
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
