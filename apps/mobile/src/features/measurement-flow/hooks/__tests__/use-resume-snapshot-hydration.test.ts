import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FlowNode } from "~/shared/measurements/flow-node";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";

import { useResumeSnapshotHydration } from "../use-resume-snapshot-hydration";

const { rehydrateFlowNodes, setFlowNodes, setFlowGraph, snapshotsPersist } = vi.hoisted(() => ({
  rehydrateFlowNodes: vi.fn(),
  setFlowNodes: vi.fn(),
  setFlowGraph: vi.fn(),
  snapshotsPersist: {
    hasHydrated: vi.fn(() => true),
    onFinishHydration: vi.fn(() => () => undefined),
  },
}));

vi.mock("~/features/measurement-flow/stores/use-measurement-flow-store", () => ({
  useMeasurementFlowStore: (selector: (s: unknown) => unknown) =>
    selector({ ...storeState, rehydrateFlowNodes, setFlowNodes, setFlowGraph }),
}));

vi.mock("~/features/measurement-flow/stores/use-flow-snapshots-store", () => {
  const store = (selector: (s: unknown) => unknown) => selector(snapshotsState);
  store.persist = snapshotsPersist;
  return { useFlowSnapshotsStore: store };
});

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
  protocols: { "proto-7": { code: [{ pulses: [1, 2] }], family: "multispeq" as const } },
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
  cells: WorkbookCell[];
  workbookVersionId?: string;
};

let snapshotsState: {
  workbookVersionId?: string;
  entitySnapshots?: typeof entitySnapshots;
};

beforeEach(() => {
  vi.clearAllMocks();
  snapshotsPersist.hasHydrated.mockReturnValue(true);
  storeState = { flowNodes: strippedNodes, cells, workbookVersionId: "version-17" };
  snapshotsState = { workbookVersionId: "version-17", entitySnapshots };
});

describe("useResumeSnapshotHydration", () => {
  it("is ready when nothing is unresolved", () => {
    storeState.flowNodes = hydratedNodes;

    const { result } = renderHook(() => useResumeSnapshotHydration());

    expect(result.current).toBe("ready");
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

    expect(result.current).toBe("ready");
    expect(rehydrateFlowNodes).not.toHaveBeenCalled();
  });

  it("re-attaches the code from the stored snapshots, once, without resetting progress", async () => {
    const { result } = renderHook(() => useResumeSnapshotHydration());

    await waitFor(() => expect(rehydrateFlowNodes).toHaveBeenCalledTimes(1));

    const [nodes] = rehydrateFlowNodes.mock.calls[0] as [FlowNode[]];
    expect(nodes[0].content.protocol.code).toEqual([{ pulses: [1, 2] }]);
    expect(nodes[0].content.protocolId).toBe("proto-7");
    expect(nodes[0].content.params).toEqual({ averages: 3 });
    expect(nodes[1].content.macro.code).toBe("print(1)");
    expect(setFlowNodes).not.toHaveBeenCalled();
    expect(setFlowGraph).not.toHaveBeenCalled();
    // Still loading on this render; the store write clears the gate.
    expect(result.current).toBe("loading");
  });

  it("waits for the snapshots store to hydrate before deciding anything", () => {
    snapshotsPersist.hasHydrated.mockReturnValue(false);

    const { result } = renderHook(() => useResumeSnapshotHydration());

    expect(result.current).toBe("loading");
    expect(rehydrateFlowNodes).not.toHaveBeenCalled();
  });

  it("is unavailable when the stored snapshots belong to another version", () => {
    snapshotsState.workbookVersionId = "version-16";

    const { result } = renderHook(() => useResumeSnapshotHydration());

    expect(result.current).toBe("unavailable");
    expect(rehydrateFlowNodes).not.toHaveBeenCalled();
  });

  it("is unavailable when no snapshots were stored", () => {
    snapshotsState = { workbookVersionId: undefined, entitySnapshots: undefined };

    const { result } = renderHook(() => useResumeSnapshotHydration());

    expect(result.current).toBe("unavailable");
    expect(rehydrateFlowNodes).not.toHaveBeenCalled();
  });

  it("is unavailable when the flow has no version id to match against", () => {
    storeState.workbookVersionId = undefined;

    const { result } = renderHook(() => useResumeSnapshotHydration());

    expect(result.current).toBe("unavailable");
    expect(rehydrateFlowNodes).not.toHaveBeenCalled();
  });
});
