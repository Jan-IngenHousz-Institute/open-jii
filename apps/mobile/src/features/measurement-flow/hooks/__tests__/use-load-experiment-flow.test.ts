import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";

import { useLoadExperimentFlow } from "../use-load-experiment-flow";

const { listUseQuery, versionUseQuery, prepareFlow, clearPreparedFlow } = vi.hoisted(() => ({
  listUseQuery: vi.fn(),
  versionUseQuery: vi.fn(),
  prepareFlow: vi.fn(),
  clearPreparedFlow: vi.fn(),
}));

vi.mock("~/shared/api/tsr", () => ({
  tsr: {
    experiments: {
      listExperiments: { useQuery: listUseQuery },
    },
    workbooks: {
      getWorkbookVersion: { useQuery: versionUseQuery },
    },
  },
}));

vi.mock("~/features/measurement-flow/stores/use-workbook-flow-store", () => ({
  useWorkbookFlowStore: (selector: (s: unknown) => unknown) =>
    selector({ prepareFlow, clearPreparedFlow }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  listUseQuery.mockReturnValue({ data: undefined, isLoading: false });
  versionUseQuery.mockReturnValue({ data: undefined, isLoading: false, error: null });
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
    listUseQuery.mockReturnValue({
      data: { body: [{ id: "e1", workbookId: "w1", workbookVersionId: "v1" }] },
      isLoading: false,
    });
    const entitySnapshots = { protocols: {}, macros: {} };
    versionUseQuery.mockReturnValue({
      data: { body: { cells, entitySnapshots } },
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useLoadExperimentFlow("e1"));

    await waitFor(() => expect(prepareFlow).toHaveBeenCalled());
    const [cellsArg, snapshotsArg] = prepareFlow.mock.calls[0] as [unknown, unknown];
    expect(cellsArg).toBe(cells);
    expect(snapshotsArg).toBe(entitySnapshots);
    expect(clearPreparedFlow).not.toHaveBeenCalled();
    expect(result.current.isReady).toBe(true);
  });

  it("surfaces an error when the experiment has no workbook", () => {
    listUseQuery.mockReturnValue({
      data: { body: [{ id: "e1", workbookId: null, workbookVersionId: null }] },
      isLoading: false,
    });

    const { result } = renderHook(() => useLoadExperimentFlow("e1"));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isReady).toBe(false);
    expect((result.current.error as Error)?.message).toContain("no workbook version");
    expect(prepareFlow).not.toHaveBeenCalled();
    // Stale graph from a prior experiment is cleared on a failed load.
    expect(clearPreparedFlow).toHaveBeenCalled();
  });

  it("surfaces a listExperiments error instead of hanging in loading", () => {
    const err = new Error("list failed");
    listUseQuery.mockReturnValue({ data: undefined, isLoading: false, error: err });

    const { result } = renderHook(() => useLoadExperimentFlow("e1"));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(err);
    expect(result.current.isReady).toBe(false);
    expect(prepareFlow).not.toHaveBeenCalled();
  });
});
