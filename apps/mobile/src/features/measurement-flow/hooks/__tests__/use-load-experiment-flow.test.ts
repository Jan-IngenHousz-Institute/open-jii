import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  FlowEdge,
  FlowNode,
} from "~/features/measurement-flow/screens/measurement-flow-screen/types";
import { orderFlowNodes } from "~/shared/utils/order-flow-nodes";

import type { WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";
import { cellsToFlowGraph } from "@repo/api/utils/cells-to-flow";

import { useLoadExperimentFlow } from "../use-load-experiment-flow";

const { listUseQuery, flowUseQuery, versionUseQuery, setFlowGraph, setFlowNodes } = vi.hoisted(
  () => ({
    listUseQuery: vi.fn(),
    flowUseQuery: vi.fn(),
    versionUseQuery: vi.fn(),
    setFlowGraph: vi.fn(),
    setFlowNodes: vi.fn(),
  }),
);

vi.mock("~/shared/api/tsr", () => ({
  tsr: {
    experiments: {
      listExperiments: { useQuery: listUseQuery },
      getFlow: { useQuery: flowUseQuery },
    },
    workbooks: {
      getWorkbookVersion: { useQuery: versionUseQuery },
    },
  },
}));

vi.mock("~/features/measurement-flow/stores/use-measurement-flow-store", () => ({
  useMeasurementFlowStore: (selector: (s: unknown) => unknown) =>
    selector({ setFlowGraph, setFlowNodes }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  listUseQuery.mockReturnValue({ data: undefined, isLoading: false });
  flowUseQuery.mockReturnValue({ data: undefined, isLoading: false, error: null });
  versionUseQuery.mockReturnValue({ data: undefined, isLoading: false, error: null });
});

describe("useLoadExperimentFlow", () => {
  it("derives the graph from the workbook version (document order) when one is attached", async () => {
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
    listUseQuery.mockReturnValue({
      data: { body: [{ id: "e1", workbookId: "w1", workbookVersionId: "v1" }] },
      isLoading: false,
    });
    versionUseQuery.mockReturnValue({ data: { body: { cells } }, isLoading: false, error: null });

    const { result } = renderHook(() => useLoadExperimentFlow("e1"));

    await waitFor(() => expect(setFlowGraph).toHaveBeenCalled());
    const expected = cellsToFlowGraph(cells);
    expect(setFlowGraph).toHaveBeenCalledWith(expected.nodes, expected.edges, cells);
    expect(setFlowNodes).not.toHaveBeenCalled();
    expect(result.current.isReady).toBe(true);
  });

  it("falls back to the legacy flow when no workbook is attached", async () => {
    const nodes: FlowNode[] = [
      { id: "q1", type: "question", name: "q1", content: { kind: "number" }, isStart: true },
    ];
    const edges: FlowEdge[] = [];
    listUseQuery.mockReturnValue({
      data: { body: [{ id: "e1", workbookId: null, workbookVersionId: null }] },
      isLoading: false,
    });
    flowUseQuery.mockReturnValue({
      data: { body: { graph: { nodes, edges } } },
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useLoadExperimentFlow("e1"));

    await waitFor(() => expect(setFlowNodes).toHaveBeenCalled());
    expect(setFlowNodes).toHaveBeenCalledWith(orderFlowNodes(nodes, edges));
    expect(setFlowGraph).not.toHaveBeenCalled();
    expect(result.current.isReady).toBe(true);
  });

  it("surfaces a listExperiments error instead of hanging in loading", () => {
    const err = new Error("list failed");
    listUseQuery.mockReturnValue({ data: undefined, isLoading: false, error: err });

    const { result } = renderHook(() => useLoadExperimentFlow("e1"));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(err);
    expect(result.current.isReady).toBe(false);
    expect(setFlowGraph).not.toHaveBeenCalled();
    expect(setFlowNodes).not.toHaveBeenCalled();
  });
});
