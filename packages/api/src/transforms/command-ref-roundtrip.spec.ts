import { describe, it, expect } from "vitest";

import type { BranchCell, WorkbookCell } from "../domains/workbook/workbook-cells.schema";
import { cellsToFlowGraph } from "./cells-to-flow";
import { flowNodesToWorkbookCells } from "./flow-to-workbook-cells";

const uuidA = "11111111-1111-1111-1111-111111111111";

// macro -> dynamic command -> branch (loop back to the macro) -> trailing markdown
const cells: WorkbookCell[] = [
  { id: "m1", type: "macro", isCollapsed: false, payload: { macroId: uuidA, language: "python" } },
  {
    id: "c1",
    type: "command",
    isCollapsed: false,
    payload: { kind: "ref", ref: { sourceCellId: "m1", field: "toDevice" }, name: "Send LED" },
  },
  {
    id: "b1",
    type: "branch",
    isCollapsed: false,
    paths: [
      {
        id: "p1",
        label: "Retry",
        color: "#10b981",
        conditions: [{ id: "cond1", sourceCellId: "c1", field: "ok", operator: "eq", value: "1" }],
        gotoCellId: "m1",
      },
    ],
    defaultPathId: "p1",
  },
  { id: "md-end", type: "markdown", isCollapsed: false, content: "Done" },
];

describe("dynamic command + branch round-trip", () => {
  it("cells -> flow keeps one ref node and the sequential + goto edges", () => {
    const graph = cellsToFlowGraph(cells);

    const commandNodes = graph.nodes.filter(
      (n) => (n.content as { command?: { kind?: string } }).command?.kind === "ref",
    );
    expect(commandNodes).toHaveLength(1);
    expect(graph.edges.find((e) => e.source === "m1" && e.target === "c1")).toBeTruthy();
    expect(graph.edges.find((e) => e.source === "c1" && e.target === "b1")).toBeTruthy();
    // Goto/loop edge carries the path id as source handle.
    expect(
      graph.edges.find((e) => e.source === "b1" && e.target === "m1" && e.sourceHandle === "p1"),
    ).toBeTruthy();
  });

  it("cells -> flow -> cells retains the ref, branch topology, conditions, and goto", () => {
    const graph = cellsToFlowGraph(cells);
    const back = flowNodesToWorkbookCells(graph.nodes, graph.edges);

    expect(back.map((c) => c.id)).toEqual(["m1", "c1", "b1", "md-end"]);

    expect(back.find((c) => c.id === "c1")).toMatchObject({
      type: "command",
      payload: { kind: "ref", ref: { sourceCellId: "m1", field: "toDevice" }, name: "Send LED" },
    });

    const branch = back.find((c) => c.id === "b1") as BranchCell;
    expect(branch.type).toBe("branch");
    expect(branch.defaultPathId).toBe("p1");
    expect(branch.paths).toEqual(cells[2] && (cells[2] as BranchCell).paths);
  });

  it("flow -> cells -> flow retains one dynamic node and the branch goto edge", () => {
    const graph1 = cellsToFlowGraph(cells);
    const cells2 = flowNodesToWorkbookCells(graph1.nodes, graph1.edges);
    const graph2 = cellsToFlowGraph(cells2);

    const refNodes = graph2.nodes.filter(
      (n) => (n.content as { command?: { kind?: string } }).command?.kind === "ref",
    );
    expect(refNodes).toHaveLength(1);
    expect((refNodes[0].content as { command: { ref: unknown } }).command.ref).toEqual({
      sourceCellId: "m1",
      field: "toDevice",
    });
    expect(
      graph2.edges.find((e) => e.source === "b1" && e.target === "m1" && e.sourceHandle === "p1"),
    ).toBeTruthy();
  });
});

describe("forward goto + multiple paths round-trip", () => {
  // m1 -> c1(ref) -> b1(branch: p1 goto FORWARD to md-end, p2 loop back to m1)
  //   -> mid -> md-end.  `mid` sits between the branch and its forward goto
  //   target, so a handle-blind traversal would drop it.
  const branched: WorkbookCell[] = [
    {
      id: "m1",
      type: "macro",
      isCollapsed: false,
      payload: { macroId: uuidA, language: "python" },
    },
    {
      id: "c1",
      type: "command",
      isCollapsed: false,
      payload: { kind: "ref", ref: { sourceCellId: "m1", field: "toDevice" } },
    },
    {
      id: "b1",
      type: "branch",
      isCollapsed: false,
      paths: [
        {
          id: "p1",
          label: "Skip",
          color: "#2563eb",
          conditions: [{ id: "k1", sourceCellId: "c1", field: "ok", operator: "eq", value: "1" }],
          gotoCellId: "md-end",
        },
        {
          id: "p2",
          label: "Loop",
          color: "#10b981",
          conditions: [{ id: "k2", sourceCellId: "m1", field: "n", operator: "gt", value: "0" }],
          gotoCellId: "m1",
        },
      ],
      defaultPathId: "p1",
    },
    { id: "mid", type: "markdown", isCollapsed: false, content: "Intervening" },
    { id: "md-end", type: "markdown", isCollapsed: false, content: "Done" },
  ];

  it("keeps full authored order and all edges through cells -> flow -> cells", () => {
    const graph = cellsToFlowGraph(branched);

    // The ordinary successor edge from the branch is the null-handle one to `mid`.
    const seq = graph.edges.find((e) => e.source === "b1" && e.sourceHandle == null);
    expect(seq?.target).toBe("mid");
    // Every path goto edge is present, keyed by its path id.
    expect(
      graph.edges.find(
        (e) => e.source === "b1" && e.sourceHandle === "p1" && e.target === "md-end",
      ),
    ).toBeTruthy();
    expect(
      graph.edges.find((e) => e.source === "b1" && e.sourceHandle === "p2" && e.target === "m1"),
    ).toBeTruthy();

    const back = flowNodesToWorkbookCells(graph.nodes, graph.edges);
    // Forward goto did NOT skip `mid`; full order is preserved.
    expect(back.map((c) => c.id)).toEqual(["m1", "c1", "b1", "mid", "md-end"]);

    const branch = back.find((c) => c.id === "b1") as BranchCell;
    expect(branch.paths).toEqual((branched[2] as BranchCell).paths);
    expect(branch.defaultPathId).toBe("p1");
  });

  it("preserves the branch topology through flow -> cells -> flow", () => {
    const cells2 = flowNodesToWorkbookCells(
      cellsToFlowGraph(branched).nodes,
      cellsToFlowGraph(branched).edges,
    );
    const graph2 = cellsToFlowGraph(cells2);

    expect(
      graph2.edges.find((e) => e.source === "b1" && e.sourceHandle == null && e.target === "mid"),
    ).toBeTruthy();
    expect(
      graph2.edges.find(
        (e) => e.source === "b1" && e.sourceHandle === "p1" && e.target === "md-end",
      ),
    ).toBeTruthy();
    expect(
      graph2.edges.find((e) => e.source === "b1" && e.sourceHandle === "p2" && e.target === "m1"),
    ).toBeTruthy();
  });
});
