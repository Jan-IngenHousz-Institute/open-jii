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
    };
    const edgeBC: Edge = {
      id: "B->C",
      source: "B",
      target: "C",
      markerEnd: { type: MarkerType.ArrowClosed },
      animated: true,
    };

    it("removes edges connected to deleted node and reconnects incomers to outgoers", () => {
      const res = handleNodesDeleteWithReconnection(
        [nodeB],
        [nodeA, nodeB, nodeC],
        [edgeAB, edgeBC],
      );
      expect(res.some((e) => e.source === "A" && e.target === "C")).toBe(true);
      const newEdge = res.find((e) => e.source === "A" && e.target === "C");
      expect(newEdge?.animated).toBe(true);
    });

    it("does nothing if no edges connected", () => {
      const res = handleNodesDeleteWithReconnection([nodeC], [nodeA, nodeB, nodeC], [edgeAB]);
      expect(res).toEqual([edgeAB]);
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
