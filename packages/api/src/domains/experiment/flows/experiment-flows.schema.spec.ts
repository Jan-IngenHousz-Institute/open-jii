import { describe, expect, it } from "vitest";

import {
  zExperimentFlow,
  zExperimentFlowRouteInput,
  zExperimentUpsertFlowBody,
} from "./experiment-flows.schema";

const graph = {
  nodes: [
    {
      id: "start",
      type: "question" as const,
      name: "Start",
      content: { kind: "open_ended" as const, text: "Go?", required: false },
      isStart: true,
    },
  ],
  edges: [],
};

const flow = {
  id: "11111111-1111-1111-1111-111111111111",
  experimentId: "22222222-2222-2222-2222-222222222222",
  graph,
  createdAt: "2024-01-15T10:00:00.000Z",
  updatedAt: "2024-01-15T11:00:00.000Z",
};

describe("zExperimentFlow", () => {
  it("accepts a valid flow with an embedded graph", () => {
    expect(zExperimentFlow.parse(flow)).toEqual(flow);
  });

  it("rejects a non-uuid id", () => {
    expect(() => zExperimentFlow.parse({ ...flow, id: "x" })).toThrow();
  });

  it("rejects a malformed graph", () => {
    expect(() => zExperimentFlow.parse({ ...flow, graph: { nodes: "nope", edges: [] } })).toThrow();
  });
});

describe("zExperimentUpsertFlowBody", () => {
  it("accepts a valid graph", () => {
    expect(zExperimentUpsertFlowBody.parse(graph)).toEqual(graph);
  });

  it("rejects a graph missing nodes", () => {
    expect(() => zExperimentUpsertFlowBody.parse({ edges: [] })).toThrow();
  });
});

describe("zExperimentFlowRouteInput", () => {
  const id = "22222222-2222-2222-2222-222222222222";

  it("accepts the composed route id and canonical graph fields", () => {
    expect(zExperimentFlowRouteInput.parse({ id, ...graph })).toEqual({ id, ...graph });
  });

  it.each(["command", "ref", "payload", "unknown"])(
    "rejects a route-root %s key instead of stripping it",
    (key) => {
      expect(
        zExperimentFlowRouteInput.safeParse({ id, ...graph, [key]: { sentinel: true } }).success,
      ).toBe(false);
    },
  );
});
