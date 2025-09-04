import type { Node, Edge } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import { zUpsertFlowBody } from "@repo/api";

import { FlowMapper } from "../flow-mapper";

describe("Flow Conversion", () => {
  describe("Question Node Conversion", () => {
    it("should convert a valid question node", () => {
      const nodes: Node[] = [
        {
          id: "question-1",
          type: "QUESTION",
          position: { x: 0, y: 0 },
          data: {
            title: "What is your name?",
            description: "Please enter your full name",
            isStartNode: true,
          },
        },
      ];
      const edges: Edge[] = [];

      const result = FlowMapper.toApiGraph(nodes, edges);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0]).toEqual({
        id: "question-1",
        type: "question",
        name: "What is your name?",
        content: {
          kind: "open_ended",
          text: "Please enter your full name",
          required: false,
        },
        isStart: true,
        position: { x: 0, y: 0 },
      });

      // Validate with backend schema
      expect(() => zUpsertFlowBody.parse(result)).not.toThrow();
    });

    it("should use title as fallback when description is missing", () => {
      const nodes: Node[] = [
        {
          id: "question-2",
          type: "QUESTION",
          position: { x: 0, y: 0 },
          data: {
            title: "Age Question",
            isStartNode: true,
          },
        },
      ];
      const edges: Edge[] = [];

      const result = FlowMapper.toApiGraph(nodes, edges);

      expect(result.nodes[0].content).toEqual({
        kind: "open_ended",
        text: "Age Question",
        required: false,
      });
    });
  });

  describe("Instruction Node Conversion", () => {
    it("should convert a valid instruction node", () => {
      const nodes: Node[] = [
        {
          id: "instruction-1",
          type: "INSTRUCTION",
          position: { x: 0, y: 0 },
          data: {
            title: "Setup Instructions",
            description: "Please prepare your equipment",
            isStartNode: true,
          },
        },
      ];
      const edges: Edge[] = [];

      const result = FlowMapper.toApiGraph(nodes, edges);

      expect(result.nodes[0]).toEqual({
        id: "instruction-1",
        type: "instruction",
        name: "Setup Instructions",
        content: {
          text: "Please prepare your equipment",
        },
        isStart: true,
        position: { x: 0, y: 0 },
      });

      // Validate with backend schema
      expect(() => zUpsertFlowBody.parse(result)).not.toThrow();
    });
  });

  describe("Measurement Node Conversion", () => {
    it("should convert a valid measurement node with protocol", () => {
      const protocolId = "550e8400-e29b-41d4-a716-446655440000";
      const nodes: Node[] = [
        {
          id: "measurement-1",
          type: "MEASUREMENT",
          position: { x: 0, y: 0 },
          data: {
            title: "CO2 Measurement",
            protocolId: protocolId,
            isStartNode: true,
          },
        },
      ];
      const edges: Edge[] = [];

      const result = FlowMapper.toApiGraph(nodes, edges);

      expect(result.nodes[0]).toEqual({
        id: "measurement-1",
        type: "measurement",
        name: "CO2 Measurement",
        content: {
          protocolId: protocolId,
          params: {},
        },
        isStart: true,
        position: { x: 0, y: 0 },
      });

      // Validate with backend schema
      expect(() => zUpsertFlowBody.parse(result)).not.toThrow();
    });

    it("should throw error when measurement node has no protocol", () => {
      const nodes: Node[] = [
        {
          id: "measurement-2",
          type: "MEASUREMENT",
          position: { x: 0, y: 0 },
          data: {
            title: "Invalid Measurement",
            isStartNode: true,
          },
        },
      ];
      const edges: Edge[] = [];

      expect(() => FlowMapper.toApiGraph(nodes, edges)).toThrow(
        "A valid protocol must be selected for measurement nodes",
      );
    });
  });

  describe("Complete Flow Validation", () => {
    it("should convert and validate a complete flow", () => {
      const protocolId = "550e8400-e29b-41d4-a716-446655440000";
      const nodes: Node[] = [
        {
          id: "start-question",
          type: "QUESTION",
          position: { x: 0, y: 0 },
          data: {
            title: "Start Question",
            description: "Are you ready to begin?",
            isStartNode: true,
          },
        },
        {
          id: "instruction-1",
          type: "INSTRUCTION",
          position: { x: 200, y: 0 },
          data: {
            title: "Setup",
            description: "Prepare your equipment",
          },
        },
        {
          id: "measurement-1",
          type: "MEASUREMENT",
          position: { x: 400, y: 0 },
          data: {
            title: "Data Collection",
            protocolId: protocolId,
          },
        },
      ];
      const edges: Edge[] = [
        {
          id: "edge-1",
          source: "start-question",
          target: "instruction-1",
          data: { label: "Yes" },
        },
        {
          id: "edge-2",
          source: "instruction-1",
          target: "measurement-1",
        },
      ];

      const result = FlowMapper.toApiGraph(nodes, edges);

      expect(result.nodes).toHaveLength(3);
      expect(result.edges).toHaveLength(2);

      // Validate that exactly one node is marked as start
      const startNodes = result.nodes.filter((node) => node.isStart);
      expect(startNodes).toHaveLength(1);
      expect(startNodes[0].id).toBe("start-question");

      // Validate with backend schema - this should not throw
      expect(() => zUpsertFlowBody.parse(result)).not.toThrow();
    });

    it("should fail validation if no start node is present", () => {
      const nodes: Node[] = [
        {
          id: "question-1",
          type: "QUESTION",
          position: { x: 0, y: 0 },
          data: {
            title: "Question without start",
            description: "This has no start node",
            isStartNode: false,
          },
        },
      ];
      const edges: Edge[] = [];

      expect(() => FlowMapper.toApiGraph(nodes, edges)).toThrow(
        "Exactly one start node is required",
      );
    });
  });

  describe("Edge Conversion", () => {
    it("should convert edges with labels", () => {
      const nodes: Node[] = [
        {
          id: "start",
          type: "QUESTION",
          position: { x: 0, y: 0 },
          data: {
            title: "Start",
            isStartNode: true,
          },
        },
      ];
      const edges: Edge[] = [
        {
          id: "edge-1",
          source: "start",
          target: "start", // self-loop for simplicity
          data: { label: "Continue" },
        },
      ];

      const result = FlowMapper.toApiGraph(nodes, edges);

      expect(result.edges[0]).toEqual({
        id: "edge-1",
        source: "start",
        target: "start",
        label: "Continue",
      });
    });

    it("should handle edges without labels", () => {
      const nodes: Node[] = [
        {
          id: "start",
          type: "QUESTION",
          position: { x: 0, y: 0 },
          data: {
            title: "Start",
            isStartNode: true,
          },
        },
      ];
      const edges: Edge[] = [
        {
          id: "edge-1",
          source: "start",
          target: "start", // self-loop for simplicity
        },
      ];

      const result = FlowMapper.toApiGraph(nodes, edges);

      expect(result.edges[0].label).toBeUndefined();
    });
  });
});
