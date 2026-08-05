// flow-utils.test.ts
import { MarkerType } from "@xyflow/react";
import type { Node, Edge } from "@xyflow/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  connectFlowNodes,
  getWorkbookCellInsertionIndex,
  getInitialFlowData,
  handleNodesDeleteWithReconnection,
  handleNodeDrop,
} from "../flow-utils";

vi.mock("../../flow-editor/flow-mapper", () => ({
  FlowMapper: {
    toApiGraph: vi.fn(),
  },
}));

// Simple fake validator
vi.mock("../node-utils", () => ({
  validateFlowNodes: vi.fn(() => true),
  createNewNode: vi.fn((type: string, pos: { x: number; y: number }) => ({
    id: "new-node",
    type,
    position: pos,
    data: {},
  })),
}));

describe("flow-utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getInitialFlowData returns empty arrays", () => {
    const res = getInitialFlowData();
    expect(res).toEqual({ nodes: [], edges: [] });
  });

  describe("handleNodesDeleteWithReconnection", () => {
    const nodeA: Node = { id: "A", type: "t", position: { x: 0, y: 0 }, data: {} };
    const nodeB: Node = { id: "B", type: "t", position: { x: 0, y: 0 }, data: {} };
    const nodeC: Node = { id: "C", type: "t", position: { x: 0, y: 0 }, data: {} };

    const edgeAB: Edge = {
      id: "A->B",
      source: "A",
      target: "B",
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { kind: "sequence" },
    };
    const edgeBC: Edge = {
      id: "B->C",
      source: "B",
      target: "C",
      markerEnd: { type: MarkerType.ArrowClosed },
      animated: true,
      data: { kind: "sequence" },
    };

    it("removes edges connected to deleted node and reconnects incomers to outgoers", () => {
      const res = handleNodesDeleteWithReconnection(
        [nodeB],
        [nodeA, nodeB, nodeC],
        [edgeAB, edgeBC],
      );
      expect(res.edges.some((e) => e.source === "A" && e.target === "C")).toBe(true);
      const newEdge = res.edges.find((e) => e.source === "A" && e.target === "C");
      expect(newEdge?.animated).toBe(true);
      expect(newEdge?.data).toEqual({ kind: "sequence" });
    });

    it("does nothing if no edges connected", () => {
      const res = handleNodesDeleteWithReconnection([nodeC], [nodeA, nodeB, nodeC], [edgeAB]);
      expect(res).toEqual({ edges: [edgeAB], issues: [] });
    });

    it("deleting a branch reconnects only its sequence neighbors", () => {
      const branch: Node = { id: "B", type: "BRANCH", position: { x: 0, y: 0 }, data: {} };
      const pathEdge: Edge = {
        id: "path",
        source: "B",
        target: "A",
        sourceHandle: "path-1",
        data: { kind: "branch" },
      };
      const res = handleNodesDeleteWithReconnection(
        [branch],
        [nodeA, branch, nodeC],
        [edgeAB, edgeBC, pathEdge],
      );
      expect(res.edges).toHaveLength(1);
      expect(res.edges[0]).toMatchObject({
        source: "A",
        target: "C",
        data: { kind: "sequence" },
      });
    });

    it("deleting a branch goto target removes the reference and reports a repair issue", () => {
      const pathEdge: Edge = {
        id: "path",
        source: "A",
        target: "B",
        sourceHandle: "path-1",
        data: { kind: "branch" },
      };
      const res = handleNodesDeleteWithReconnection(
        [nodeB],
        [nodeA, nodeB, nodeC],
        [edgeAB, edgeBC, pathEdge],
      );
      expect(res.edges).toHaveLength(1);
      expect(res.edges[0]).toMatchObject({ source: "A", target: "C" });
      expect(res.issues).toEqual([
        {
          kind: "branch-target-deleted",
          deletedNodeId: "B",
          branchNodeId: "A",
          pathId: "path-1",
        },
      ]);
    });

    it("deleting the start node leaves the next node without a predecessor", () => {
      const res = handleNodesDeleteWithReconnection(
        [nodeA],
        [nodeA, nodeB, nodeC],
        [edgeAB, edgeBC],
      );
      expect(res).toEqual({ edges: [edgeBC], issues: [] });
    });

    it("does not turn a path incomer into a sequence edge", () => {
      const nodeD: Node = { id: "D", type: "BRANCH", position: { x: 0, y: 0 }, data: {} };
      const pathEdge: Edge = {
        id: "path",
        source: "D",
        target: "B",
        sourceHandle: "path-1",
        data: { kind: "branch" },
      };
      const res = handleNodesDeleteWithReconnection(
        [nodeB],
        [nodeA, nodeB, nodeC, nodeD],
        [edgeAB, edgeBC, pathEdge],
      );
      expect(res.edges).toHaveLength(1);
      expect(res.edges[0]).toMatchObject({
        source: "A",
        target: "C",
        data: { kind: "sequence" },
      });
      expect(res.edges.some((edge) => edge.source === "D")).toBe(false);
    });
  });

  describe("connectFlowNodes", () => {
    const nodes: Node[] = [
      { id: "A", type: "INSTRUCTION", position: { x: 0, y: 0 }, data: { isStartNode: true } },
      { id: "B", type: "QUESTION", position: { x: 0, y: 0 }, data: {} },
      { id: "C", type: "ANALYSIS", position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [
      { id: "AB", source: "A", target: "B", data: { kind: "sequence" } },
      { id: "BC", source: "B", target: "C", data: { kind: "sequence" } },
    ];

    it("moves a sequence target immediately after the source and rebuilds one chain", () => {
      const result = connectFlowNodes(
        { source: "A", target: "C", sourceHandle: "out", targetHandle: "in" },
        nodes,
        edges,
      );
      expect(result.edges).toEqual([
        expect.objectContaining({ source: "A", target: "C", data: { kind: "sequence" } }),
        expect.objectContaining({ source: "C", target: "B", data: { kind: "sequence" } }),
      ]);
      expect(result.nodes.find((node) => node.id === "A")?.data.isStartNode).toBe(true);
    });

    it("updates the start marker when the previous start is moved", () => {
      const result = connectFlowNodes(
        { source: "C", target: "A", sourceHandle: "out", targetHandle: "in" },
        nodes,
        edges,
      );
      expect(result.nodes.find((node) => node.id === "B")?.data.isStartNode).toBe(true);
      expect(result.edges.map((edge) => `${edge.source}->${edge.target}`)).toEqual([
        "B->C",
        "C->A",
      ]);
    });

    it("retargets one branch path without touching sequence edges", () => {
      const branchNodes: Node[] = [
        {
          ...nodes[0],
          id: "branch",
          type: "BRANCH",
          data: {
            isStartNode: true,
            stepSpecification: { paths: [{ id: "path-1", label: "Retry" }] },
          },
        },
        nodes[1],
        nodes[2],
      ];
      const branchEdges: Edge[] = [
        { id: "seq-1", source: "branch", target: "B", data: { kind: "sequence" } },
        { id: "seq-2", source: "B", target: "C", data: { kind: "sequence" } },
        {
          id: "old-path",
          source: "branch",
          target: "B",
          sourceHandle: "path-1",
          data: { kind: "branch" },
        },
      ];
      const result = connectFlowNodes(
        { source: "branch", target: "C", sourceHandle: "path-1", targetHandle: "in" },
        branchNodes,
        branchEdges,
      );
      expect(result.edges.filter((edge) => edge.data?.kind === "sequence")).toHaveLength(2);
      expect(result.edges.filter((edge) => edge.data?.kind === "branch")).toEqual([
        expect.objectContaining({
          source: "branch",
          target: "C",
          sourceHandle: "path-1",
          data: { kind: "branch", label: "Retry" },
        }),
      ]);
    });

    it("refuses to retarget an ambiguous legacy branch handle", () => {
      const branchNodes: Node[] = [
        {
          ...nodes[0],
          id: "branch",
          type: "BRANCH",
          data: {
            isStartNode: true,
            stepSpecification: {
              paths: [
                { id: "duplicate", label: "First" },
                { id: "duplicate", label: "Second" },
              ],
            },
          },
        },
        nodes[1],
        nodes[2],
      ];
      const branchEdges: Edge[] = [
        { id: "seq-1", source: "branch", target: "B", data: { kind: "sequence" } },
        { id: "seq-2", source: "B", target: "C", data: { kind: "sequence" } },
        {
          id: "first",
          source: "branch",
          target: "B",
          sourceHandle: "duplicate",
          data: { kind: "branch" },
        },
        {
          id: "second",
          source: "branch",
          target: "C",
          sourceHandle: "duplicate",
          data: { kind: "branch" },
        },
      ];

      expect(() =>
        connectFlowNodes(
          { source: "branch", target: "C", sourceHandle: "duplicate", targetHandle: "in" },
          branchNodes,
          branchEdges,
        ),
      ).toThrow(/ambiguous/);
      expect(branchEdges).toHaveLength(4);
    });
  });

  describe("getWorkbookCellInsertionIndex", () => {
    it("inserts before the first node to the right while keeping an output with its producer", () => {
      const cells = [
        {
          id: "A",
          type: "protocol" as const,
          isCollapsed: false,
          payload: {
            protocolId: "11111111-1111-1111-1111-111111111111",
            version: 1,
          },
        },
        { id: "out", type: "output" as const, isCollapsed: false, producedBy: "A" },
        { id: "B", type: "markdown" as const, isCollapsed: false, content: "Next" },
      ];
      const nodes: Node[] = [
        { id: "A", position: { x: 0, y: 0 }, data: {} },
        { id: "B", position: { x: 200, y: 0 }, data: {} },
      ];
      expect(getWorkbookCellInsertionIndex(cells, nodes, 100)).toBe(2);
      expect(getWorkbookCellInsertionIndex(cells, nodes, 300)).toBe(3);
    });
  });

  describe("handleNodeDrop", () => {
    const baseEvent = {
      preventDefault: vi.fn(),
      dataTransfer: { getData: vi.fn() },
      clientX: 50,
      clientY: 60,
      currentTarget: {
        getBoundingClientRect: () => ({ left: 10, top: 20 }),
      },
    } as unknown as React.DragEvent;

    it("returns null if disabled", () => {
      const result = handleNodeDrop(baseEvent, [], true);
      expect(result).toBeNull();
    });

    it("returns null if no type", () => {
      const e = { ...baseEvent, dataTransfer: { getData: () => "" } } as unknown as React.DragEvent;
      const result = handleNodeDrop(e, [], false);
      expect(result).toBeNull();
    });

    it("creates new node and position when valid drop", () => {
      const e = {
        ...baseEvent,
        dataTransfer: { getData: () => "question" },
      } as unknown as React.DragEvent;
      const result = handleNodeDrop(e, [], false);
      expect(result?.newNode).toMatchObject({ id: "new-node", type: "question" });
      expect(result?.position).toEqual({ x: 40, y: 40 });
    });

    it("marks first node as start node", () => {
      const e = {
        ...baseEvent,
        dataTransfer: { getData: () => "question" },
      } as unknown as React.DragEvent;
      const result = handleNodeDrop(e, [], false);
      expect(result?.newNode.data.isStartNode).toBe(true);
    });

    it("does not set isStartNode if not the first node", () => {
      const e = {
        ...baseEvent,
        dataTransfer: { getData: () => "question" },
      } as unknown as React.DragEvent;
      const existingNode: Node = { id: "X", type: "t", position: { x: 0, y: 0 }, data: {} };
      const result = handleNodeDrop(e, [existingNode], false);
      expect(result?.newNode.data.isStartNode).toBeUndefined();
    });
  });
});
