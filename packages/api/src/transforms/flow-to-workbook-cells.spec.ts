import { describe, it, expect } from "vitest";
import type { z } from "zod";

import type {
  zExperimentFlowEdge,
  zExperimentFlowNode,
} from "../domains/experiment/experiment.schema";
import { orderFlowNodes, flowNodesToWorkbookCells } from "./flow-to-workbook-cells";

type FlowNode = z.infer<typeof zExperimentFlowNode>;
type FlowEdge = z.infer<typeof zExperimentFlowEdge>;

const uuidA = "11111111-1111-1111-1111-111111111111";
const uuidB = "22222222-2222-2222-2222-222222222222";
const _uuidC = "33333333-3333-3333-3333-333333333333";

function makeNode(overrides: Partial<FlowNode> & { id: string; type: string }): FlowNode {
  return {
    name: overrides.type,
    position: { x: 0, y: 0 },
    content: {},
    isStart: false,
    ...overrides,
  } as FlowNode;
}

function makeEdge(source: string, target: string): FlowEdge {
  return { id: `${source}->${target}`, source, target };
}

describe("orderFlowNodes", () => {
  it("returns empty array for empty input", () => {
    expect(orderFlowNodes([], [])).toEqual([]);
  });

  it("returns single node as-is", () => {
    const nodes = [makeNode({ id: "n1", type: "measurement", isStart: true })];
    const result = orderFlowNodes(nodes, []);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("n1");
  });

  it("orders nodes following edge chain from start", () => {
    const nodes = [
      makeNode({ id: "n1", type: "measurement", isStart: true }),
      makeNode({ id: "n2", type: "analysis" }),
      makeNode({ id: "n3", type: "question" }),
    ];
    const edges = [makeEdge("n1", "n2"), makeEdge("n2", "n3")];
    const result = orderFlowNodes(nodes, edges);
    expect(result.map((n) => n.id)).toEqual(["n1", "n2", "n3"]);
  });

  it("starts from first node when no isStart flag", () => {
    const nodes = [
      makeNode({ id: "n1", type: "measurement" }),
      makeNode({ id: "n2", type: "analysis" }),
    ];
    const edges = [makeEdge("n1", "n2")];
    const result = orderFlowNodes(nodes, edges);
    expect(result[0].id).toBe("n1");
  });

  it("does not visit nodes twice (cycle protection)", () => {
    const nodes = [
      makeNode({ id: "n1", type: "measurement", isStart: true }),
      makeNode({ id: "n2", type: "analysis" }),
    ];
    const edges = [makeEdge("n1", "n2"), makeEdge("n2", "n1")];
    const result = orderFlowNodes(nodes, edges);
    expect(result).toHaveLength(2);
  });

  it("retains disconnected nodes after the chain, in original node-array order", () => {
    const nodes = [
      makeNode({ id: "n1", type: "measurement", isStart: true }),
      makeNode({ id: "n2", type: "analysis" }),
      makeNode({ id: "n3", type: "question" }),
    ];
    const edges = [makeEdge("n1", "n2")];
    // Chain is n1 -> n2; n3 is disconnected and kept at the end (not dropped).
    const result = orderFlowNodes(nodes, edges);
    expect(result.map((n) => n.id)).toEqual(["n1", "n2", "n3"]);
  });

  it("appends multiple disconnected nodes in deterministic original order", () => {
    const nodes = [
      makeNode({ id: "start", type: "measurement", isStart: true }),
      makeNode({ id: "b", type: "analysis" }),
      makeNode({ id: "a", type: "question" }),
    ];
    // No edges: only `start` is on the chain; `b` then `a` follow array order.
    expect(orderFlowNodes(nodes, []).map((n) => n.id)).toEqual(["start", "b", "a"]);
  });

  it("chooses the ordinary edge as the chain successor, never a goto edge", () => {
    const nodes = [
      makeNode({ id: "b1", type: "branch", isStart: true }),
      makeNode({ id: "goto-target", type: "analysis" }),
      makeNode({ id: "next", type: "measurement" }),
    ];
    // Goto edge is listed FIRST; a handle-blind "first unvisited" would wrongly
    // make goto-target the successor of b1.
    const edges: FlowEdge[] = [
      { id: "e-goto", source: "b1", target: "goto-target", sourceHandle: "p1" },
      { id: "e-seq", source: "b1", target: "next", sourceHandle: null },
    ];
    // `next` is the ordinary successor; the goto-only `goto-target` is retained
    // but appended after the chain (never dropped, never the successor).
    const result = orderFlowNodes(nodes, edges);
    expect(result.map((n) => n.id)).toEqual(["b1", "next", "goto-target"]);
  });
});

describe("flowNodesToWorkbookCells", () => {
  it("returns empty array for empty input", () => {
    expect(flowNodesToWorkbookCells([], [])).toEqual([]);
  });

  it("converts measurement node to protocol cell", () => {
    const nodes = [
      makeNode({
        id: "m1",
        type: "measurement",
        name: "Phi2",
        isStart: true,
        content: { protocolId: uuidA },
      }),
    ];
    const cells = flowNodesToWorkbookCells(nodes, []);
    expect(cells).toHaveLength(1);
    expect(cells[0]).toMatchObject({
      id: "m1",
      type: "protocol",
      isCollapsed: false,
      payload: { protocolId: uuidA, version: 1, name: "Phi2" },
    });
  });

  it("converts analysis node to macro cell", () => {
    const nodes = [
      makeNode({
        id: "a1",
        type: "analysis",
        name: "CalcPhi2",
        isStart: true,
        content: { macroId: uuidB },
      }),
    ];
    const cells = flowNodesToWorkbookCells(nodes, []);
    expect(cells).toHaveLength(1);
    expect(cells[0]).toMatchObject({
      id: "a1",
      type: "macro",
      isCollapsed: false,
      payload: { macroId: uuidB, language: "javascript", name: "CalcPhi2" },
    });
  });

  it("converts question node to question cell", () => {
    const question = { text: "How sunny?", kind: "open_ended", required: true };
    const nodes = [
      makeNode({
        id: "q1",
        type: "question",
        isStart: true,
        content: question,
      }),
    ];
    const cells = flowNodesToWorkbookCells(nodes, []);
    expect(cells).toHaveLength(1);
    expect(cells[0]).toMatchObject({
      id: "q1",
      type: "question",
      isCollapsed: false,
      isAnswered: false,
    });
  });

  it("converts instruction node to markdown cell", () => {
    const nodes = [
      makeNode({
        id: "i1",
        type: "instruction",
        isStart: true,
        content: { text: "Point at a leaf" },
      }),
    ];
    const cells = flowNodesToWorkbookCells(nodes, []);
    expect(cells).toHaveLength(1);
    expect(cells[0]).toMatchObject({
      id: "i1",
      type: "markdown",
      isCollapsed: false,
      content: "Point at a leaf",
    });
  });

  it("skips unknown node types", () => {
    const nodes = [makeNode({ id: "u1", type: "unknown_type" as never, isStart: true })];
    const cells = flowNodesToWorkbookCells(nodes, []);
    expect(cells).toHaveLength(0);
  });

  it("preserves edge-based ordering across multiple nodes", () => {
    const nodes = [
      makeNode({ id: "i1", type: "instruction", content: { text: "Go" }, isStart: true }),
      makeNode({ id: "m1", type: "measurement", name: "Phi2", content: { protocolId: uuidA } }),
      makeNode({ id: "a1", type: "analysis", name: "Calc", content: { macroId: uuidB } }),
    ];
    const edges = [makeEdge("i1", "m1"), makeEdge("m1", "a1")];
    const cells = flowNodesToWorkbookCells(nodes, edges);
    expect(cells.map((c) => c.type)).toEqual(["markdown", "protocol", "macro"]);
  });

  it("handles empty instruction text gracefully", () => {
    const nodes = [
      makeNode({ id: "i1", type: "instruction", isStart: true, content: {} as never }),
    ];
    const cells = flowNodesToWorkbookCells(nodes, []);
    expect(cells).toHaveLength(1);
    expect((cells[0] as { content: string }).content).toBe("");
  });

  it("converts an inline-command measurement node to a command cell", () => {
    const nodes = [
      makeNode({
        id: "m2",
        type: "measurement",
        name: "battery",
        isStart: true,
        content: { command: { format: "string", content: "battery" } },
      }),
    ];
    const cells = flowNodesToWorkbookCells(nodes, []);
    expect(cells).toHaveLength(1);
    expect(cells[0]).toMatchObject({
      id: "m2",
      type: "command",
      payload: { format: "string", content: "battery" },
    });
  });

  it("converts a ref-carrier measurement node back to a dynamic command cell", () => {
    const nodes = [
      makeNode({
        id: "c1",
        type: "measurement",
        name: "Dynamic command · toDevice",
        isStart: true,
        content: { command: { kind: "ref", ref: { sourceCellId: "m1", field: "toDevice" } } },
      }),
    ];
    const cells = flowNodesToWorkbookCells(nodes, []);
    expect(cells).toHaveLength(1);
    // The derived label is dropped rather than fabricated into an authored name.
    expect(cells[0]).toEqual({
      id: "c1",
      type: "command",
      isCollapsed: false,
      payload: { kind: "ref", ref: { sourceCellId: "m1", field: "toDevice" } },
    });
  });

  it("keeps an authored name that differs from the derived label", () => {
    const nodes = [
      makeNode({
        id: "c1",
        type: "measurement",
        name: "Send LED",
        isStart: true,
        content: { command: { kind: "ref", ref: { sourceCellId: "m1", field: "toDevice" } } },
      }),
    ];
    const cells = flowNodesToWorkbookCells(nodes, []);
    expect(cells[0]).toMatchObject({
      type: "command",
      payload: { kind: "ref", ref: { sourceCellId: "m1", field: "toDevice" }, name: "Send LED" },
    });
  });

  it("drops a mixed protocol+command measurement node instead of retyping it", () => {
    const nodes = [
      makeNode({
        id: "mix",
        type: "measurement",
        isStart: true,
        content: { protocolId: uuidA, command: { format: "string", content: "battery" } },
      }),
    ];
    // Mixed carrier is rejected (not stripped/retyped to a command or protocol cell).
    expect(flowNodesToWorkbookCells(nodes, [])).toHaveLength(0);
  });

  it("reconstructs a branch cell from node content (conditions + goto)", () => {
    const nodes = [
      makeNode({
        id: "b1",
        type: "branch",
        isStart: true,
        content: {
          paths: [
            {
              id: "p1",
              label: "Retry",
              color: "#10b981",
              conditions: [
                { id: "cond1", sourceCellId: "m1", field: "ok", operator: "eq", value: "1" },
              ],
              gotoCellId: "m1",
            },
          ],
          defaultPathId: "p1",
        },
      }),
    ];
    const cells = flowNodesToWorkbookCells(nodes, []);
    expect(cells).toHaveLength(1);
    expect(cells[0]).toEqual({
      id: "b1",
      type: "branch",
      isCollapsed: false,
      defaultPathId: "p1",
      paths: [
        {
          id: "p1",
          label: "Retry",
          color: "#10b981",
          conditions: [
            { id: "cond1", sourceCellId: "m1", field: "ok", operator: "eq", value: "1" },
          ],
          gotoCellId: "m1",
        },
      ],
    });
  });

  it("recovers a branch goto from the outgoing edge when content omits it", () => {
    // Legacy graph: branch content has no gotoCellId; goto lives on the edge.
    const nodes = [
      makeNode({
        id: "b1",
        type: "branch",
        isStart: true,
        content: { paths: [{ id: "p1", label: "Loop", color: "#000" }] },
      }),
    ];
    const edges = [{ id: "e1", source: "b1", target: "m1", sourceHandle: "p1", label: "Loop" }];
    const cells = flowNodesToWorkbookCells(nodes, edges);
    expect(cells[0]).toMatchObject({
      type: "branch",
      paths: [{ id: "p1", gotoCellId: "m1", conditions: [] }],
    });
  });

  it("retains a legacy goto-only target node (never dropped) in deterministic order", () => {
    // start -> branch (ordinary); branch --p1 goto--> gtarget (edge only, no
    // ordinary edge into gtarget). gtarget must still be converted and kept.
    const nodes = [
      makeNode({ id: "start", type: "measurement", isStart: true, content: { protocolId: uuidA } }),
      makeNode({
        id: "b1",
        type: "branch",
        content: { paths: [{ id: "p1", label: "Go", color: "#000" }] },
      }),
      makeNode({ id: "gtarget", type: "instruction", content: { text: "Jump here" } }),
    ];
    const edges: FlowEdge[] = [
      { id: "e-seq", source: "start", target: "b1", sourceHandle: null },
      { id: "e-goto", source: "b1", target: "gtarget", sourceHandle: "p1" },
    ];
    const cells = flowNodesToWorkbookCells(nodes, edges);
    // Chain [start, b1] first, then the goto-only `gtarget` appended.
    expect(cells.map((c) => c.id)).toEqual(["start", "b1", "gtarget"]);
    const branch = cells.find((c) => c.id === "b1");
    expect(branch).toMatchObject({ type: "branch", paths: [{ id: "p1", gotoCellId: "gtarget" }] });
  });
});
