// flow-utils.test.ts
import { MarkerType } from "@xyflow/react";
import type { Node, Edge } from "@xyflow/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import {
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
