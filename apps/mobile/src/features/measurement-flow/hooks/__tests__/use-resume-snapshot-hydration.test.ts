import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FlowNode } from "~/shared/measurements/flow-node";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";

import { useResumeSnapshotHydration } from "../use-resume-snapshot-hydration";

const { useWorkbookVersionQueryMock, rehydrateFlowNodes, setFlowNodes, setFlowGraph } = vi.hoisted(
  () => ({
    useWorkbookVersionQueryMock: vi.fn(),
    rehydrateFlowNodes: vi.fn(),
    setFlowNodes: vi.fn(),
    setFlowGraph: vi.fn(),
  }),
);

vi.mock("~/features/experiments/hooks/use-experiment-flow-query", () => ({
  useWorkbookVersionQuery: (...args: unknown[]) => useWorkbookVersionQueryMock(...args),
}));

vi.mock("~/features/measurement-flow/stores/use-measurement-flow-store", () => ({
  useMeasurementFlowStore: (selector: (s: unknown) => unknown) =>
    selector({ ...storeState, rehydrateFlowNodes, setFlowNodes, setFlowGraph }),
}));

const cells: WorkbookCell[] = [
  {
    id: "node-m1",
    type: "protocol",
    isCollapsed: false,
    payload: { protocolId: "proto-7", version: 1, name: "SPAD" },
  },
  {
    id: "node-a1",
    type: "macro",
    isCollapsed: false,
    payload: { macroId: "macro-9", language: "python", name: "SPAD macro" },
  },
];

const entitySnapshots = {
  protocols: { "proto-7": { code: [{ pulses: [1, 2] }], family: "multispeq" } },
  macros: { "macro-9": { code: "print(1)" } },
};

const strippedNodes: FlowNode[] = [
  {
    id: "node-m1",
    name: "spad_reading",
    type: "measurement",
    isStart: false,
    content: { params: { averages: 3 }, protocolId: "proto-7", protocol: { name: "SPAD" } },
  },
  {
    id: "node-a1",
    name: "spad_macro",
    type: "analysis",
    isStart: false,
    content: {
      params: {},
      macroId: "macro-9",
      macro: { id: "macro-9", name: "SPAD macro", filename: "macro-9.py", language: "python" },
    },
  },
];

const hydratedNodes: FlowNode[] = [
  {
    ...strippedNodes[0],
    content: {
      ...strippedNodes[0].content,
      protocol: { name: "SPAD", code: [{ pulses: [1, 2] }] },
    },
  },
  {
    ...strippedNodes[1],
    content: {
      ...strippedNodes[1].content,
      macro: { ...strippedNodes[1].content.macro, code: "" },
    },
  },
];

let storeState: {
  flowNodes: FlowNode[];
  workbookId?: string;
  workbookVersionId?: string;
};

function mockQuery(result: Record<string, unknown>) {
  useWorkbookVersionQueryMock.mockReturnValue({
    data: undefined,
    error: null,
    isPaused: false,
    ...result,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  storeState = {
    flowNodes: strippedNodes,
    workbookId: "workbook-17",
    workbookVersionId: "version-17",
  };
  mockQuery({});
});

describe("useResumeSnapshotHydration", () => {
  it("is ready and leaves the version query disabled when nothing is unresolved", () => {
    storeState.flowNodes = hydratedNodes;

    const { result } = renderHook(() => useResumeSnapshotHydration());

    expect(result.current).toEqual({ status: "ready" });
    expect(useWorkbookVersionQueryMock).toHaveBeenCalledWith(undefined, undefined, {
      suppressToast: true,
    });
    expect(rehydrateFlowNodes).not.toHaveBeenCalled();
  });

  it("treats resolved-empty code as ready rather than gating forever", () => {
    storeState.flowNodes = [
      {
        ...strippedNodes[0],
        content: { ...strippedNodes[0].content, protocol: { name: "SPAD", code: [] } },
      },
      {
        ...strippedNodes[1],
        content: {
          ...strippedNodes[1].content,
          macro: { ...strippedNodes[1].content.macro, code: "" },
        },
      },
    ];

    const { result } = renderHook(() => useResumeSnapshotHydration());

    expect(result.current).toEqual({ status: "ready" });
    expect(rehydrateFlowNodes).not.toHaveBeenCalled();
  });

  it("re-attaches the code from the version's entitySnapshots, once", async () => {
    mockQuery({ data: { cells, entitySnapshots } });

    const { result } = renderHook(() => useResumeSnapshotHydration());

    expect(useWorkbookVersionQueryMock).toHaveBeenCalledWith("workbook-17", "version-17", {
      suppressToast: true,
    });
    await waitFor(() => expect(rehydrateFlowNodes).toHaveBeenCalledTimes(1));

    const [nodes] = rehydrateFlowNodes.mock.calls[0] as [FlowNode[]];
    expect(nodes[0].content.protocol.code).toEqual([{ pulses: [1, 2] }]);
    expect(nodes[0].content.protocolId).toBe("proto-7");
    expect(nodes[0].content.params).toEqual({ averages: 3 });
    expect(nodes[1].content.macro.code).toBe("print(1)");
    expect(setFlowNodes).not.toHaveBeenCalled();
    expect(setFlowGraph).not.toHaveBeenCalled();
    // Still loading on this render; the store write clears the gate.
    expect(result.current).toEqual({ status: "loading" });
  });

  it("reports loading while the version query is pending", () => {
    const { result } = renderHook(() => useResumeSnapshotHydration());

    expect(result.current).toEqual({ status: "loading" });
    expect(rehydrateFlowNodes).not.toHaveBeenCalled();
  });

  it("reports offline when the query is paused with nothing cached", () => {
    mockQuery({ isPaused: true });

    const { result } = renderHook(() => useResumeSnapshotHydration());

    expect(result.current).toEqual({ status: "unavailable", reason: "offline" });
  });

  it("reports version-missing on a 404", () => {
    mockQuery({ error: Object.assign(new Error("Not found"), { status: 404 }) });

    const { result } = renderHook(() => useResumeSnapshotHydration());

    expect(result.current).toEqual({ status: "unavailable", reason: "version-missing" });
  });

  it("reports error for any other query failure", () => {
    mockQuery({ error: Object.assign(new Error("Boom"), { status: 500 }) });

    const { result } = renderHook(() => useResumeSnapshotHydration());

    expect(result.current).toEqual({ status: "unavailable", reason: "error" });
  });

  it("reports version-missing instead of hanging when the ids are gone", () => {
    storeState.workbookId = undefined;
    storeState.workbookVersionId = undefined;

    const { result } = renderHook(() => useResumeSnapshotHydration());

    expect(result.current).toEqual({ status: "unavailable", reason: "version-missing" });
    expect(rehydrateFlowNodes).not.toHaveBeenCalled();
  });
});
