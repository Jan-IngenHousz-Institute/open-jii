import { describe, it, expect } from "vitest";

import type { WorkbookCell } from "../schemas/workbook-cells.schema";
import { cellsToFlowGraph } from "./cells-to-flow";

const uuidA = "11111111-1111-1111-1111-111111111111";
const uuidB = "22222222-2222-2222-2222-222222222222";

describe("cellsToFlowGraph", () => {
  it("returns empty graph for empty cells", () => {
    const result = cellsToFlowGraph([]);
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });

  it("positions a single node at center", () => {
    const cells: WorkbookCell[] = [
      {
        id: "p1",
        type: "protocol",
        isCollapsed: false,
        payload: { protocolId: uuidA, version: 1 },
      },
    ];
    const { nodes } = cellsToFlowGraph(cells);
    expect(nodes[0].position).toEqual({ x: 0, y: 240 });
  });

  it("converts a single protocol ref cell to a measurement node", () => {
    const cells: WorkbookCell[] = [
      {
        id: "p1",
        type: "protocol",
        isCollapsed: false,
        payload: { protocolId: uuidA, version: 1 },
      },
    ];
    const { nodes, edges } = cellsToFlowGraph(cells);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe("p1");
    expect(nodes[0].type).toBe("measurement");
    expect(nodes[0].isStart).toBe(true);
    expect(edges).toHaveLength(0);
  });

  it("converts a single macro ref cell to an analysis node", () => {
    const cells: WorkbookCell[] = [
      {
        id: "m1",
        type: "macro",
        isCollapsed: false,
        payload: { macroId: uuidA, language: "python" },
      },
    ];
    const { nodes } = cellsToFlowGraph(cells);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe("analysis");
    expect(nodes[0].isStart).toBe(true);
  });

  it("converts a question cell to a question node", () => {
    const cells: WorkbookCell[] = [
      {
        id: "q1",
        type: "question",
        isCollapsed: false,
        isAnswered: false,
        question: { kind: "yes_no", text: "Is it green?", required: false },
      },
    ];
    const { nodes } = cellsToFlowGraph(cells);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe("question");
    expect(nodes[0].name).toBe("Is it green?");
  });

  it("converts a markdown cell to an instruction node", () => {
    const cells: WorkbookCell[] = [
      { id: "md1", type: "markdown", isCollapsed: false, content: "Step 1: prepare sample" },
    ];
    const { nodes } = cellsToFlowGraph(cells);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe("instruction");
    expect(nodes[0].name).toBe("Step 1: prepare sample");
  });

  it("skips output cells", () => {
    const cells: WorkbookCell[] = [
      { id: "o1", type: "output", isCollapsed: false, producedBy: "p1" },
    ];
    const { nodes, edges } = cellsToFlowGraph(cells);
    expect(nodes).toHaveLength(0);
    expect(edges).toHaveLength(0);
  });

  it("macro cells always produce a node", () => {
    const cells: WorkbookCell[] = [
      {
        id: "m1",
        type: "macro",
        isCollapsed: false,
        payload: { macroId: uuidA, language: "python" },
      },
    ];
    const { nodes } = cellsToFlowGraph(cells);
    expect(nodes).toHaveLength(1);
  });

  it("chains sequential cells with edges", () => {
    const cells: WorkbookCell[] = [
      { id: "md1", type: "markdown", isCollapsed: false, content: "Intro" },
      {
        id: "p1",
        type: "protocol",
        isCollapsed: false,
        payload: { protocolId: uuidA, version: 1 },
      },
      {
        id: "m1",
        type: "macro",
        isCollapsed: false,
        payload: { macroId: uuidB, language: "python" },
      },
    ];
    const { nodes, edges } = cellsToFlowGraph(cells);
    expect(nodes).toHaveLength(3);
    expect(edges).toHaveLength(2);

    // First cell is start
    expect(nodes[0].isStart).toBe(true);
    expect(nodes[1].isStart).toBe(false);
    expect(nodes[2].isStart).toBe(false);

    // Edges chain sequentially
    expect(edges[0]).toEqual({
      id: "e-md1-p1",
      source: "md1",
      target: "p1",
      label: null,
    });
    expect(edges[1]).toEqual({
      id: "e-p1-m1",
      source: "p1",
      target: "m1",
      label: null,
    });

    // Nodes are positioned in a horizontal chain
    expect(nodes[0].position).toEqual({ x: -250, y: 240 });
    expect(nodes[1].position).toEqual({ x: 0, y: 240 });
    expect(nodes[2].position).toEqual({ x: 250, y: 240 });
  });

  it("handles a branch cell with gotoCellId (loop)", () => {
    const cells: WorkbookCell[] = [
      {
        id: "p1",
        type: "protocol",
        isCollapsed: false,
        payload: { protocolId: uuidA, version: 1 },
      },
      {
        id: "b1",
        type: "branch",
        isCollapsed: false,
        paths: [
          {
            id: "path1",
            label: "Retry",
            color: "#10b981",
            conditions: [
              { id: "c1", sourceCellId: "p1", field: "Fv/Fm", operator: "gt", value: "0.5" },
            ],
            gotoCellId: "p1",
          },
        ],
      },
      { id: "md-end", type: "markdown", isCollapsed: false, content: "Done" },
    ];
    const { nodes, edges } = cellsToFlowGraph(cells);

    // p1 + b1 + md-end = 3 nodes
    expect(nodes).toHaveLength(3);

    // p1 -> b1 sequential
    expect(edges.find((e) => e.source === "p1" && e.target === "b1")).toBeTruthy();

    // b1 -> p1 loop back-edge with path label
    const loopEdge = edges.find((e) => e.source === "b1" && e.target === "p1");
    expect(loopEdge).toBeTruthy();
    expect(loopEdge?.label).toBe("Retry");

    // b1 -> md-end sequential
    expect(edges.find((e) => e.source === "b1" && e.target === "md-end")).toBeTruthy();
  });

  it("handles a branch cell without gotoCellId", () => {
    const cells: WorkbookCell[] = [
      {
        id: "b1",
        type: "branch",
        isCollapsed: false,
        paths: [
          {
            id: "path1",
            label: "Path 1",
            color: "#10b981",
            conditions: [
              { id: "c1", sourceCellId: "p1", field: "count", operator: "gte", value: "10" },
            ],
          },
        ],
      },
      { id: "md1", type: "markdown", isCollapsed: false, content: "After" },
    ];
    const { nodes, edges } = cellsToFlowGraph(cells);

    // b1 + md1 = 2 nodes
    expect(nodes).toHaveLength(2);

    // No loop edge, just sequential
    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe("b1");
    expect(edges[0].target).toBe("md1");
  });

  it("skips output cells in a mixed sequence", () => {
    const cells: WorkbookCell[] = [
      {
        id: "p1",
        type: "protocol",
        isCollapsed: false,
        payload: { protocolId: uuidA, version: 1 },
      },
      { id: "o1", type: "output", isCollapsed: false, producedBy: "p1" },
      { id: "md1", type: "markdown", isCollapsed: false, content: "Analysis" },
    ];
    const { nodes, edges } = cellsToFlowGraph(cells);

    // Output is skipped
    expect(nodes).toHaveLength(2);
    expect(nodes.find((n) => n.id === "o1")).toBeUndefined();

    // p1 -> md1 directly
    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe("p1");
    expect(edges[0].target).toBe("md1");
  });

  it("truncates markdown name to 64 chars", () => {
    const longContent = "x".repeat(100);
    const cells: WorkbookCell[] = [
      { id: "md1", type: "markdown", isCollapsed: false, content: longContent },
    ];
    const { nodes } = cellsToFlowGraph(cells);
    expect(nodes[0].name).toHaveLength(64);
  });
});
