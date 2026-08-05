import { describe, it, expect } from "vitest";
import type { z } from "zod";

import type {
  zExperimentFlowEdge,
  zExperimentFlowNode,
} from "../domains/experiment/experiment.schema";
import type { WorkbookCell } from "../domains/workbook/workbook-cells.schema";
import { cellsToFlowGraph } from "./cells-to-flow";
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
  return { id: `${source}->${target}`, source, target, data: { kind: "sequence" } };
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

  it("rejects a graph without exactly one start node", () => {
    const nodes = [
      makeNode({ id: "n1", type: "measurement" }),
      makeNode({ id: "n2", type: "analysis" }),
    ];
    const edges = [makeEdge("n1", "n2")];
    expect(() => orderFlowNodes(nodes, edges)).toThrow("Exactly one start node");
  });

  it("rejects a cycle", () => {
    const nodes = [
      makeNode({ id: "n1", type: "measurement", isStart: true }),
      makeNode({ id: "n2", type: "analysis" }),
    ];
    const edges = [makeEdge("n1", "n2"), makeEdge("n2", "n1")];
    expect(() => orderFlowNodes(nodes, edges)).toThrow();
  });

  it("rejects disconnected nodes", () => {
    const nodes = [
      makeNode({ id: "n1", type: "measurement", isStart: true }),
      makeNode({ id: "n2", type: "analysis" }),
      makeNode({ id: "n3", type: "question" }),
    ];
    const edges = [makeEdge("n1", "n2")];
    expect(() => orderFlowNodes(nodes, edges)).toThrow(
      "Sequence edges must form one chain covering every node exactly once",
    );
  });

  it("ignores branch reference edges while ordering", () => {
    const nodes = [
      makeNode({ id: "n1", type: "branch", isStart: true }),
      makeNode({ id: "n2", type: "analysis" }),
      makeNode({ id: "n3", type: "question" }),
    ];
    const edges: FlowEdge[] = [
      makeEdge("n1", "n2"),
      makeEdge("n2", "n3"),
      {
        id: "branch",
        source: "n1",
        target: "n3",
        sourceHandle: "path-1",
        data: { kind: "branch" },
      },
    ];
    expect(orderFlowNodes(nodes, edges).map((node) => node.id)).toEqual(["n1", "n2", "n3"]);
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

  it("preserves every existing payload byte-for-byte while applying order", () => {
    const existing: WorkbookCell[] = [
      {
        id: "p1",
        type: "protocol",
        isCollapsed: true,
        payload: { protocolId: uuidA, version: 17, name: "Original protocol" },
      },
      {
        id: "o1",
        type: "output",
        isCollapsed: true,
        producedBy: "p1",
        data: { value: 42 },
        messages: ["kept"],
      },
      {
        id: "q1",
        type: "question",
        isCollapsed: true,
        name: "leaf_colour",
        question: {
          kind: "multi_choice",
          text: "Leaf colour?",
          options: ["green", "yellow"],
          required: true,
        },
        answer: "green",
        isAnswered: true,
      },
    ];
    const graph = cellsToFlowGraph(existing);
    const reversedNodes = graph.nodes.map((node, index) => ({
      ...node,
      isStart: index === graph.nodes.length - 1,
    }));
    const reversedEdges: FlowEdge[] = [
      {
        id: "q1-p1",
        source: "q1",
        target: "p1",
        data: { kind: "sequence" },
      },
    ];

    expect(flowNodesToWorkbookCells(reversedNodes, reversedEdges, existing)).toEqual([
      existing[2],
      existing[0],
      existing[1],
    ]);
  });

  it("round-trips a container-free workbook byte-identically", () => {
    const cells: WorkbookCell[] = [
      { id: "md1", type: "markdown", isCollapsed: true, content: "Prepare leaf" },
      {
        id: "p1",
        type: "protocol",
        isCollapsed: false,
        payload: { protocolId: uuidA, version: 9, name: "Phi2" },
      },
      {
        id: "out1",
        type: "output",
        isCollapsed: false,
        producedBy: "p1",
        data: [{ value: 0.7 }],
        executionTime: 12,
      },
      {
        id: "b1",
        type: "branch",
        isCollapsed: true,
        paths: [
          {
            id: "path1",
            label: "Retry",
            color: "#10b981",
            conditions: [
              {
                id: "cond1",
                sourceCellId: "p1",
                field: "value",
                operator: "lt",
                value: "0.5",
              },
            ],
            gotoCellId: "p1",
          },
          {
            id: "path2",
            label: "Finish",
            color: "#f59e0b",
            conditions: [],
          },
        ],
        defaultPathId: "path2",
        evaluatedPathId: "path1",
      },
      {
        id: "m1",
        type: "macro",
        isCollapsed: true,
        payload: { macroId: uuidB, language: "python", name: "Keep language" },
      },
    ];
    const graph = cellsToFlowGraph(cells);
    expect(flowNodesToWorkbookCells(graph.nodes, graph.edges, cells)).toEqual(cells);
  });

  it("retargets and clears branch gotos without rebuilding branch payload", () => {
    const branch: WorkbookCell = {
      id: "b1",
      type: "branch",
      isCollapsed: true,
      paths: [
        {
          id: "path1",
          label: "Retry",
          color: "#10b981",
          conditions: [
            { id: "c1", sourceCellId: "q1", field: "answer", operator: "eq", value: "yes" },
          ],
          gotoCellId: "q1",
        },
      ],
    };
    const target: WorkbookCell = {
      id: "q1",
      type: "question",
      isCollapsed: false,
      name: "answer",
      question: { kind: "yes_no", text: "Continue?", required: false },
      isAnswered: false,
    };
    const graph = cellsToFlowGraph([branch, target]);
    const pathEdge = graph.edges.find((edge) => edge.data?.kind === "branch");
    expect(pathEdge).toBeDefined();

    const retargeted = flowNodesToWorkbookCells(
      graph.nodes,
      graph.edges.map((edge) =>
        edge.id === pathEdge?.id ? { ...edge, target: "b1" } : edge,
      ),
      [branch, target],
    );
    expect(retargeted[0]).toEqual({
      ...branch,
      paths: [{ ...branch.paths[0], gotoCellId: "b1" }],
    });

    const cleared = flowNodesToWorkbookCells(
      graph.nodes,
      graph.edges.filter((edge) => edge.data?.kind !== "branch"),
      [branch, target],
    );
    expect(cleared[0]).toEqual({
      ...branch,
      paths: [
        {
          id: "path1",
          label: "Retry",
          color: "#10b981",
          conditions: branch.paths[0].conditions,
        },
      ],
    });
  });
});
