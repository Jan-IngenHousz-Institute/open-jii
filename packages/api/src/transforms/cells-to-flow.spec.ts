import { describe, it, expect } from "vitest";

import { zExperimentFlowGraph } from "../domains/experiment/experiment.schema";
import type { WorkbookCell } from "../domains/workbook/workbook-cells.schema";
import { cellsToFlowGraph, deriveFlowNodeName } from "./cells-to-flow";

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

  it("converts a question cell to a question node, using the cell's name as the node name", () => {
    const cells: WorkbookCell[] = [
      {
        id: "q1",
        type: "question",
        name: "is_green",
        isCollapsed: false,
        isAnswered: false,
        question: { kind: "yes_no", text: "Is it green?", required: false },
      },
    ];
    const { nodes } = cellsToFlowGraph(cells);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe("question");
    expect(nodes[0].name).toBe("is_green");
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

    expect(nodes[0].isStart).toBe(true);
    expect(nodes[1].isStart).toBe(false);
    expect(nodes[2].isStart).toBe(false);

    expect(edges[0]).toEqual({
      id: "e-md1-p1",
      source: "md1",
      target: "p1",
      label: null,
      sourceHandle: null,
      data: { kind: "sequence" },
    });
    expect(edges[1]).toEqual({
      id: "e-p1-m1",
      source: "p1",
      target: "m1",
      label: null,
      sourceHandle: null,
      data: { kind: "sequence" },
    });

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

    expect(nodes).toHaveLength(3);

    expect(edges.find((e) => e.source === "p1" && e.target === "b1")).toBeTruthy();

    const loopEdge = edges.find((e) => e.source === "b1" && e.target === "p1");
    expect(loopEdge).toBeTruthy();
    expect(loopEdge?.label).toBe("Retry");
    expect(loopEdge?.data).toEqual({ kind: "branch" });

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

    expect(nodes).toHaveLength(2);

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

    expect(nodes).toHaveLength(2);
    expect(nodes.find((n) => n.id === "o1")).toBeUndefined();

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

  it("uses a safe label for empty markdown without changing its content", () => {
    const cells: WorkbookCell[] = [
      { id: "md1", type: "markdown", isCollapsed: false, content: "" },
    ];
    const { nodes } = cellsToFlowGraph(cells);
    expect(nodes[0].name).toBe("Instruction");
    expect(nodes[0].content).toEqual({ text: "" });
  });

  it("falls back and truncates protocol and macro labels to the flow schema limit", () => {
    const cells: WorkbookCell[] = [
      {
        id: "p1",
        type: "protocol",
        isCollapsed: false,
        payload: { protocolId: uuidA, version: 1, name: "" },
      },
      {
        id: "m1",
        type: "macro",
        isCollapsed: false,
        payload: { macroId: uuidB, language: "python", name: "m".repeat(100) },
      },
    ];
    const { nodes } = cellsToFlowGraph(cells);
    expect(nodes[0].name).toBe("Protocol 11111111");
    expect(nodes[1].name).toBe("m".repeat(64));
    expect(zExperimentFlowGraph.safeParse(cellsToFlowGraph(cells)).success).toBe(true);
  });

  it("uses the projection's safe-label rule for a raw live title without mutating it", () => {
    const rawTitle = "Protocol ".repeat(10);
    const cell: WorkbookCell = {
      id: "p1",
      type: "protocol",
      isCollapsed: false,
      payload: { protocolId: uuidA, version: 1, name: rawTitle },
    };

    expect(deriveFlowNodeName(cell, rawTitle)).toBe(rawTitle.trim().slice(0, 64));
    expect(cell.payload.name).toBe(rawTitle);
  });

  it("converts an inline command cell to a measurement node carrying the command", () => {
    const cells: WorkbookCell[] = [
      {
        id: "c1",
        type: "command",
        isCollapsed: false,
        payload: { format: "string", content: "battery" },
      },
    ];
    const { nodes } = cellsToFlowGraph(cells);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe("measurement");
    expect(nodes[0].name).toBe("battery");
    expect(nodes[0].content).toEqual({ command: { format: "string", content: "battery" } });
  });

  it("derives a single-line node name from multi-line command content", () => {
    const cells: WorkbookCell[] = [
      {
        id: "c1",
        type: "command",
        isCollapsed: false,
        payload: { format: "yaml", content: "cmd: battery\nrepeat: 2" },
      },
    ];
    // Newlines are collapsed to spaces so the flow-editor label stays on one line.
    expect(cellsToFlowGraph(cells).nodes[0].name).toBe("cmd: battery repeat: 2");
  });

  it("falls back to a safe node name when a command has neither name nor content", () => {
    const cells: WorkbookCell[] = [
      { id: "c1", type: "command", isCollapsed: false, payload: { format: "string", content: "" } },
    ];
    // Never an empty string: zFlowNode.name requires a minimum length of 1.
    expect(cellsToFlowGraph(cells).nodes[0].name).toBe("Command");
  });

  it("projects a parallel container atomically with lane bodies inside its content", () => {
    const container: Extract<WorkbookCell, { type: "parallel" }> = {
      id: "parallel-1",
      type: "parallel",
      isCollapsed: true,
      name: "Canopy",
      defaultLaneId: "fallback",
      lanes: [
        {
          id: "sun",
          label: "Sun",
          color: "#f59e0b",
          conditions: [
            { id: "c", sourceCellId: "$device", field: "index", operator: "lt", value: "2" },
          ],
          body: [{ id: "inside", type: "markdown", isCollapsed: false, content: "Lane body" }],
        },
        {
          id: "fallback",
          label: "Fallback",
          color: "#64748b",
          conditions: [],
          body: [
            {
              id: "inside-2",
              type: "command",
              isCollapsed: false,
              payload: { format: "string", content: "battery" },
            },
          ],
        },
      ],
    };
    const cells: WorkbookCell[] = [container];

    const graph = cellsToFlowGraph(cells);
    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0]).toMatchObject({
      id: "parallel-1",
      type: "parallel",
      content: { name: "Canopy", defaultLaneId: "fallback", lanes: container.lanes },
    });
    expect(graph.nodes.some((node) => node.id === "inside" || node.id === "inside-2")).toBe(false);

    // A pre-container converter drops the unknown node and therefore drops its
    // opaque body with it; no lane cell can become a flat executable sibling.
    const oldKnownNodes = graph.nodes.filter((node) => node.type !== "parallel");
    expect(oldKnownNodes).toEqual([]);
  });
});
