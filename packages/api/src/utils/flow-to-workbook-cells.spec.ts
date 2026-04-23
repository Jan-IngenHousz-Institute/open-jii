import { describe, it, expect } from "vitest";
import type { z } from "zod";

import type { zFlowEdge, zFlowNode } from "../schemas/experiment.schema";
import { orderFlowNodes, flowNodesToWorkbookCells } from "./flow-to-workbook-cells";

type FlowNode = z.infer<typeof zFlowNode>;
type FlowEdge = z.infer<typeof zFlowEdge>;

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
  return { id: `${source}->${target}`, source, target } as FlowEdge;
}

// ── orderFlowNodes ──────────────────────────────────────────────

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

  it("skips disconnected nodes", () => {
    const nodes = [
      makeNode({ id: "n1", type: "measurement", isStart: true }),
      makeNode({ id: "n2", type: "analysis" }),
      makeNode({ id: "n3", type: "question" }),
    ];
    const edges = [makeEdge("n1", "n2")];
    const result = orderFlowNodes(nodes, edges);
    expect(result.map((n) => n.id)).toEqual(["n1", "n2"]);
  });
});

// ── flowNodesToWorkbookCells ────────────────────────────────────

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
});
