import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FlowNode } from "~/shared/measurements/flow-node";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import { cellsToFlowGraph } from "@repo/api/transforms/cells-to-flow";

import { useLoadExperimentFlow } from "../use-load-experiment-flow";

const { useQueryMock, setFlowGraph, setFlowNodes } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  setFlowGraph: vi.fn(),
  setFlowNodes: vi.fn(),
}));

// The hook calls `useQuery(orpc.<endpoint>.queryOptions(...))` (listExperiments
// directly, getWorkbookVersion via useWorkbookVersionQuery); tag each endpoint's
// options so the single useQuery mock can return per-endpoint data.
vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return { ...actual, useQuery: (opts: unknown) => useQueryMock(opts) };
});

vi.mock("~/shared/api/orpc", () => ({
  orpc: {
    experiments: {
      listExperiments: { queryOptions: (o: object) => ({ __kind: "list", ...o }) },
    },
    workbooks: {
      getWorkbookVersion: { queryOptions: (o: object) => ({ __kind: "version", ...o }) },
    },
  },
}));

vi.mock("~/features/measurement-flow/stores/use-measurement-flow-store", () => ({
  useMeasurementFlowStore: (selector: (s: unknown) => unknown) =>
    selector({ setFlowGraph, setFlowNodes }),
}));

const results = {
  list: { data: undefined, isLoading: false } as Record<string, unknown>,
  version: { data: undefined, isLoading: false, error: null } as Record<string, unknown>,
};

beforeEach(() => {
  vi.clearAllMocks();
  results.list = { data: undefined, isLoading: false };
  results.version = { data: undefined, isLoading: false, error: null };
  useQueryMock.mockImplementation((opts: { __kind: "list" | "version" }) => results[opts.__kind]);
});

describe("useLoadExperimentFlow", () => {
  it("derives the graph from the workbook version (document order)", async () => {
    const cells: WorkbookCell[] = [
      {
        id: "p1",
        type: "protocol",
        isCollapsed: false,
        payload: { protocolId: "proto-1", version: 1 },
      },
      {
        id: "q1",
        type: "question",
        isCollapsed: false,
        name: "q1",
        question: { kind: "number", text: "q1", required: false },
        isAnswered: false,
      },
    ];
    results.list = {
      data: [{ id: "e1", workbookId: "w1", workbookVersionId: "v1" }],
      isLoading: false,
    };
    const entitySnapshots = { protocols: {}, macros: {} };
    results.version = {
      data: { cells, entitySnapshots },
      isLoading: false,
      error: null,
    };

    const { result } = renderHook(() => useLoadExperimentFlow("e1"));

    await waitFor(() => expect(setFlowGraph).toHaveBeenCalled());
    const [nodesArg, edgesArg, cellsArg] = setFlowGraph.mock.calls[0] as [
      FlowNode[],
      unknown,
      unknown,
    ];
    // Graph derived from the version's cells, with the protocol node hydrated
    // (assert the outcome directly, not via the helper under test).
    const measurement = nodesArg.find((n) => n.type === "measurement");
    expect(measurement?.content?.protocol).toBeDefined();
    expect(edgesArg).toEqual(cellsToFlowGraph(cells).edges);
    expect(cellsArg).toBe(cells);
    expect(setFlowNodes).not.toHaveBeenCalled();
    expect(result.current.isReady).toBe(true);
  });

  it("surfaces an error when the experiment has no workbook", () => {
    results.list = {
      data: [{ id: "e1", workbookId: null, workbookVersionId: null }],
      isLoading: false,
    };

    const { result } = renderHook(() => useLoadExperimentFlow("e1"));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isReady).toBe(false);
    expect((result.current.error as Error)?.message).toContain("no workbook version");
    expect(setFlowGraph).not.toHaveBeenCalled();
    // Stale graph from a prior experiment is cleared on a failed load.
    expect(setFlowNodes).toHaveBeenCalledWith([]);
  });

  it("surfaces a listExperiments error instead of hanging in loading", () => {
    const err = new Error("list failed");
    results.list = { data: undefined, isLoading: false, error: err };

    const { result } = renderHook(() => useLoadExperimentFlow("e1"));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(err);
    expect(result.current.isReady).toBe(false);
    expect(setFlowGraph).not.toHaveBeenCalled();
  });
});
