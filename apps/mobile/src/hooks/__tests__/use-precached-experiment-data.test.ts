import { describe, it, expect, vi, beforeEach } from "vitest";

import { usePrecachedExperimentData } from "../use-precached-experiment-data";

const { mockPrefetchQuery, mockGetFlow, mockGetMacro, mockGetProtocol } = vi.hoisted(() => ({
  mockPrefetchQuery: vi.fn().mockResolvedValue(undefined),
  mockGetFlow: vi.fn(),
  mockGetMacro: vi.fn(),
  mockGetProtocol: vi.fn(),
}));

let capturedQueryFn: () => Promise<any>;

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ prefetchQuery: mockPrefetchQuery }),
  useQuery: (opts: any) => {
    capturedQueryFn = opts.queryFn;
    return { data: undefined };
  },
}));

vi.mock("~/api/tsr", () => ({
  tsr: {
    experiments: { getFlow: { query: mockGetFlow } },
    macros: { getMacro: { query: mockGetMacro } },
    protocols: { getProtocol: { query: mockGetProtocol } },
  },
}));

function makeNode(overrides: { type: string; id?: string; content?: Record<string, any> }) {
  return {
    id: overrides.id ?? "node-1",
    name: "Node",
    type: overrides.type,
    content: overrides.content ?? {},
    isStart: false,
  };
}

function setupFlow(nodes: ReturnType<typeof makeNode>[]) {
  mockGetFlow.mockResolvedValue({ body: { graph: { nodes } } });
  mockGetMacro.mockResolvedValue({ body: { id: "mock" } });
  mockGetProtocol.mockResolvedValue({ body: { id: "mock" } });
}

/** Extract the queryFn from a prefetchQuery call and invoke it */
function runPrefetchQueryFn(callIndex: number) {
  const opts = mockPrefetchQuery.mock.calls[callIndex][0];
  return opts.queryFn();
}

describe("usePrecachedExperimentData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePrecachedExperimentData("exp-1");
  });

  it("prefetches macros with distinct versions separately", async () => {
    setupFlow([
      makeNode({ type: "analysis", id: "a1", content: { macroId: "macro-1", macroVersion: 2 } }),
      makeNode({ type: "analysis", id: "a2", content: { macroId: "macro-1", macroVersion: 5 } }),
    ]);

    await capturedQueryFn();

    const macroKeys = mockPrefetchQuery.mock.calls.map((c: any) => c[0].queryKey);
    expect(macroKeys).toContainEqual(["macro", "macro-1", 2]);
    expect(macroKeys).toContainEqual(["macro", "macro-1", 5]);
  });

  it("prefetches protocols with distinct versions separately", async () => {
    setupFlow([
      makeNode({
        type: "measurement",
        id: "m1",
        content: { protocolId: "proto-1", protocolVersion: 1 },
      }),
      makeNode({
        type: "measurement",
        id: "m2",
        content: { protocolId: "proto-1", protocolVersion: 3 },
      }),
    ]);

    await capturedQueryFn();

    const protoKeys = mockPrefetchQuery.mock.calls.map((c: any) => c[0].queryKey);
    expect(protoKeys).toContainEqual(["protocol", "proto-1", 1]);
    expect(protoKeys).toContainEqual(["protocol", "proto-1", 3]);
  });

  it("treats undefined version and an explicit version as distinct", async () => {
    setupFlow([
      makeNode({ type: "analysis", id: "a1", content: { macroId: "macro-1" } }),
      makeNode({ type: "analysis", id: "a2", content: { macroId: "macro-1", macroVersion: 4 } }),
    ]);

    await capturedQueryFn();

    const macroKeys = mockPrefetchQuery.mock.calls.map((c: any) => c[0].queryKey);
    expect(macroKeys).toContainEqual(["macro", "macro-1", undefined]);
    expect(macroKeys).toContainEqual(["macro", "macro-1", 4]);
  });

  it("deduplicates exact (id, version) pairs", async () => {
    setupFlow([
      makeNode({ type: "analysis", id: "a1", content: { macroId: "macro-1", macroVersion: 2 } }),
      makeNode({ type: "analysis", id: "a2", content: { macroId: "macro-1", macroVersion: 2 } }),
      makeNode({
        type: "measurement",
        id: "m1",
        content: { protocolId: "proto-1", protocolVersion: 1 },
      }),
      makeNode({
        type: "measurement",
        id: "m2",
        content: { protocolId: "proto-1", protocolVersion: 1 },
      }),
    ]);

    await capturedQueryFn();

    const keys = mockPrefetchQuery.mock.calls.map((c: any) => c[0].queryKey);
    expect(keys).toHaveLength(2);
    expect(keys).toContainEqual(["macro", "macro-1", 2]);
    expect(keys).toContainEqual(["protocol", "proto-1", 1]);
  });

  it("passes version to the API query parameter", async () => {
    setupFlow([
      makeNode({ type: "analysis", id: "a1", content: { macroId: "macro-1", macroVersion: 7 } }),
    ]);

    await capturedQueryFn();
    await runPrefetchQueryFn(0);

    expect(mockGetMacro).toHaveBeenCalledWith({
      params: { id: "macro-1" },
      query: { version: 7 },
    });
  });

  it("handles a flow with no analysis or measurement nodes", async () => {
    setupFlow([
      makeNode({ type: "instruction", id: "i1", content: { text: "Hello" } }),
      makeNode({ type: "question", id: "q1", content: { kind: "text", text: "Name?" } }),
    ]);

    await capturedQueryFn();

    expect(mockPrefetchQuery).not.toHaveBeenCalled();
  });
});
