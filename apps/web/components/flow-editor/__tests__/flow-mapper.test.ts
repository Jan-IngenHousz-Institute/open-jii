import { describe, expect, it } from "vitest";

import type { Flow } from "@repo/api";
import { zUpsertFlowBody } from "@repo/api";

import { FlowMapper } from "../flow-mapper";
import type { FlowNodeDataWithSpec } from "../flow-mapper";

// Helper to build a minimal valid Flow object
function buildApiFlow(overrides: Partial<Flow["graph"]> = {}): Flow {
  const baseGraph = {
    nodes: [
      {
        id: "start-node",
        type: "question" as const,
        name: "Start",
        content: { kind: "open_ended", text: "Welcome", required: false },
        isStart: true,
      },
    ],
    edges: [],
    ...overrides,
  };
  return {
    id: "11111111-1111-1111-1111-111111111111",
    experimentId: "22222222-2222-2222-2222-222222222222",
    graph: baseGraph as Flow["graph"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("FlowMapper.toReactFlow", () => {
  it("maps API question node to React Flow node", () => {
    const flow = buildApiFlow();
    const { nodes, edges } = FlowMapper.toReactFlow(flow);
    expect(nodes).toHaveLength(1);
    const n = nodes[0];
    expect(n.id).toBe("start-node");
    expect(n.type).toBe("QUESTION");
    const data = n.data as FlowNodeDataWithSpec;
    expect(data.title).toBe("Start");
    expect(data.isStartNode).toBe(true);
    expect(edges).toHaveLength(0);
  });

  it("maps API number question to React Flow with NUMBER answer type", () => {
    const flow = buildApiFlow({
      nodes: [
        {
          id: "number-node",
          type: "question" as const,
          name: "Age Question",
          content: { kind: "number", text: "What is your age?", required: false },
          isStart: true,
        },
      ],
    });
    const { nodes } = FlowMapper.toReactFlow(flow);
    expect(nodes).toHaveLength(1);
    const n = nodes[0];
    expect(n.id).toBe("number-node");
    expect(n.type).toBe("QUESTION");
    const data = n.data as FlowNodeDataWithSpec;
    expect(data.title).toBe("Age Question");
    expect(data.stepSpecification).toEqual({
      answerType: "NUMBER",
      validationMessage: "What is your age?",
      required: false,
    });
  });

  it("maps API yes_no question to React Flow with BOOLEAN answer type", () => {
    const flow = buildApiFlow({
      nodes: [
        {
          id: "bool-node",
          type: "question" as const,
          name: "Consent Question",
          content: { kind: "yes_no", text: "Do you agree?", required: false },
          isStart: true,
        },
      ],
    });
    const { nodes } = FlowMapper.toReactFlow(flow);
    const data = nodes[0].data as FlowNodeDataWithSpec;
    expect(data.stepSpecification).toEqual({
      answerType: "BOOLEAN",
      validationMessage: "Do you agree?",
      required: false,
    });
  });

  it("maps API multi_choice question to React Flow with SELECT answer type", () => {
    const flow = buildApiFlow({
      nodes: [
        {
          id: "multi-node",
          type: "question" as const,
          name: "Choice Question",
          content: {
            kind: "multi_choice",
            text: "Pick your favorite",
            options: ["Option A", "Option B"],
            required: false,
          },
          isStart: true,
        },
      ],
    });
    const { nodes } = FlowMapper.toReactFlow(flow);
    const data = nodes[0].data as FlowNodeDataWithSpec;
    expect(data.stepSpecification).toEqual({
      answerType: "SELECT",
      validationMessage: "Pick your favorite",
      required: false,
      options: ["Option A", "Option B"],
    });
  });
});

describe("FlowMapper round-trip", () => {
  it("API -> React -> API preserves semantic graph", () => {
    const flow = buildApiFlow({
      nodes: [
        {
          id: "start-node",
          type: "question" as const,
          name: "Question 1",
          content: { kind: "open_ended", text: "Q1", required: false },
          isStart: true,
        },
        {
          id: "instruction-1",
          type: "instruction" as const,
          name: "Instruction 1",
          content: { text: "Do something" },
          isStart: false,
        },
        {
          id: "measurement-1",
          type: "measurement" as const,
          name: "Measurement 1",
          content: { protocolId: "550e8400-e29b-41d4-a716-446655440000", params: {} },
          isStart: false,
        },
      ],
      edges: [
        { id: "e1", source: "start-node", target: "instruction-1" },
        { id: "e2", source: "instruction-1", target: "measurement-1", label: "Next" },
      ],
    });

    const reactSide = FlowMapper.toReactFlow(flow);
    const back = FlowMapper.toApiGraph(reactSide.nodes, reactSide.edges);

    // Validate schema
    expect(() => zUpsertFlowBody.parse(back)).not.toThrow();

    // Compare node ids/types and start flags (positions are ephemeral)
    const simplifiedOriginal = flow.graph.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      isStart: n.isStart,
    }));
    const simplifiedBack = back.nodes.map((n) => ({ id: n.id, type: n.type, isStart: n.isStart }));
    expect(simplifiedBack).toEqual(simplifiedOriginal);

    // Edge preservation
    expect(back.edges).toHaveLength(flow.graph.edges.length);
    expect(back.edges.map((e) => e.id).sort()).toEqual(flow.graph.edges.map((e) => e.id).sort());
  });
});

describe("FlowMapper.toApiGraph validation", () => {
  it("converts NUMBER answer type to number kind", () => {
    const flow = buildApiFlow();
    const { nodes } = FlowMapper.toReactFlow(flow);

    // Simulate user selecting NUMBER answer type
    const data = nodes[0].data as FlowNodeDataWithSpec;
    data.stepSpecification = {
      answerType: "NUMBER",
      validationMessage: "Enter your age",
      required: false,
    };

    const result = FlowMapper.toApiGraph(nodes, []);
    expect(result.nodes[0].content).toEqual({
      kind: "number",
      text: "Enter your age",
      required: false,
    });
  });

  it("converts BOOLEAN answer type to yes_no kind", () => {
    const flow = buildApiFlow();
    const { nodes } = FlowMapper.toReactFlow(flow);

    const data = nodes[0].data as FlowNodeDataWithSpec;
    data.stepSpecification = {
      answerType: "BOOLEAN",
      validationMessage: "Do you agree?",
      required: false,
    };

    const result = FlowMapper.toApiGraph(nodes, []);
    expect(result.nodes[0].content).toEqual({
      kind: "yes_no",
      text: "Do you agree?",
      required: false,
    });
  });

  it("converts SELECT answer type to multi_choice kind", () => {
    const flow = buildApiFlow();
    const { nodes } = FlowMapper.toReactFlow(flow);

    const data = nodes[0].data as FlowNodeDataWithSpec;
    data.stepSpecification = {
      answerType: "SELECT",
      validationMessage: "Pick one",
      required: false,
      options: ["A", "B"],
    };

    const result = FlowMapper.toApiGraph(nodes, []);
    expect(result.nodes[0].content).toEqual({
      kind: "multi_choice",
      text: "Pick one",
      options: ["A", "B"],
      required: false,
    });
  });

  it("converts TEXT answer type to open_ended kind", () => {
    const flow = buildApiFlow();
    const { nodes } = FlowMapper.toReactFlow(flow);

    const data = nodes[0].data as FlowNodeDataWithSpec;
    data.stepSpecification = {
      answerType: "TEXT",
      validationMessage: "Tell us more",
      required: false,
    };

    const result = FlowMapper.toApiGraph(nodes, []);
    expect(result.nodes[0].content).toEqual({
      kind: "open_ended",
      text: "Tell us more",
      required: false,
    });
  });

  it("errors when multiple start nodes exist", () => {
    const flow = buildApiFlow({
      nodes: [
        {
          id: "s1",
          type: "question" as const,
          name: "S1",
          content: { kind: "open_ended", text: "t", required: false },
          isStart: true,
        },
        {
          id: "s2",
          type: "instruction" as const,
          name: "S2",
          content: { text: "t2" },
          isStart: true,
        },
      ],
    });
    const { nodes } = FlowMapper.toReactFlow(flow);
    expect(() => FlowMapper.toApiGraph(nodes, [])).toThrow(/Exactly one start node/);
  });

  it("errors when measurement node missing protocol", () => {
    const flow = buildApiFlow({
      nodes: [
        {
          id: "m1",
          type: "measurement" as const,
          name: "M1",
          content: { protocolId: "550e8400-e29b-41d4-a716-446655440000", params: {} },
          isStart: true,
        },
      ],
    });
    const react = FlowMapper.toReactFlow(flow);
    // Simulate user clearing protocolId (remove stepSpecification & protocolId)
    react.nodes[0].type = "MEASUREMENT"; // ensure measurement type
    const data = react.nodes[0].data as FlowNodeDataWithSpec;
    data.stepSpecification = undefined;
    data.protocolId = undefined;
    expect(() => FlowMapper.toApiGraph(react.nodes, react.edges)).toThrow(
      "A valid protocol must be selected for measurement nodes",
    );
  });
});
