import { orpc } from "@/lib/orpc";
import { createExperiment } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act, createTestQueryClient } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { orpcContract } from "@repo/api/orpc-contract";

import { useDetachWorkbook } from "./useDetachWorkbook";

const experimentId = "11111111-1111-1111-1111-111111111111";

describe("useDetachWorkbook", () => {
  it("calls detach endpoint and returns updated experiment", async () => {
    const updatedExperiment = createExperiment({
      id: experimentId,
      workbookId: null,
      workbookVersionId: "33333333-3333-3333-3333-333333333333",
    });
    const spy = server.mount(orpcContract.experiments.detachWorkbook, {
      body: updatedExperiment,
    });

    const { result } = renderHook(() => useDetachWorkbook());

    act(() => {
      result.current.mutate({ id: experimentId });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(spy.called).toBe(true);
  });

  it("invalidates the workbook caches using the experiment's workbookId (OJD-1626)", async () => {
    const workbookId = "22222222-2222-2222-2222-222222222222";
    server.mount(orpcContract.experiments.detachWorkbook, {
      body: createExperiment({ id: experimentId, workbookId: null }),
    });

    const queryClient = createTestQueryClient();
    queryClient.setQueryData(
      orpc.experiments.getExperiment.queryKey({ input: { id: experimentId } }),
      createExperiment({ id: experimentId, workbookId }),
    );
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDetachWorkbook(), { queryClient });

    act(() => {
      result.current.mutate({ id: experimentId });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: orpc.workbooks.getWorkbook.key({ input: { id: workbookId } }),
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: orpc.workbooks.listWorkbookVersions.key({ input: { id: workbookId } }),
      }),
    );
  });

  it("handles error state", async () => {
    server.mount(orpcContract.experiments.detachWorkbook, { status: 500 });

    const { result } = renderHook(() => useDetachWorkbook());

    act(() => {
      result.current.mutate({ id: experimentId });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
