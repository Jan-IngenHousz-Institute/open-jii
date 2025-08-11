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
        content: { kind: "open_ended", text: "Welcome" },
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
});

describe("FlowMapper round-trip", () => {
  it("API -> React -> API preserves semantic graph", () => {
    const flow = buildApiFlow({
      nodes: [
        {
          id: "start-node",
          type: "question" as const,
          name: "Question 1",
          content: { kind: "open_ended", text: "Q1" },
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
  it("errors when multiple start nodes exist", () => {
    const flow = buildApiFlow({
      nodes: [
        {
          id: "s1",
          type: "question" as const,
          name: "S1",
          content: { kind: "open_ended", text: "t" },
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
    expect(() => FlowMapper.toApiGraph(react.nodes, react.edges)).toThrow(/requires a protocol/);
  });
});
