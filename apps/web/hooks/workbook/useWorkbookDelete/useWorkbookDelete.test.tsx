import { orpc } from "@/lib/orpc";
import { createWorkbook } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act, createTestQueryClient } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { orpcContract } from "@repo/api/orpc-contract";

import { useWorkbookDelete } from "./useWorkbookDelete";

describe("useWorkbookDelete", () => {
  it("calls DELETE /workbooks/:id", async () => {
    const spy = server.mount(orpcContract.workbooks.deleteWorkbook, { status: 204 });

    const { result } = renderHook(() => useWorkbookDelete());

    act(() => {
      result.current.mutate({ id: "wb-1" });
    });

    await waitFor(() => {
      expect(spy.params).toMatchObject({ id: "wb-1" });
    });
  });

  it("completes the delete mutation", async () => {
    server.mount(orpcContract.workbooks.deleteWorkbook, { status: 204 });

    const { result } = renderHook(() => useWorkbookDelete());

    act(() => {
      result.current.mutate({ id: "wb-2" });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("removes the individual workbook query from cache", async () => {
    server.mount(orpcContract.workbooks.deleteWorkbook, { status: 204 });

    const detailKey = orpc.workbooks.getWorkbook.queryKey({ input: { id: "wb-3" } });
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(detailKey, createWorkbook({ id: "wb-3" }));

    const { result } = renderHook(() => useWorkbookDelete(), { queryClient });

    act(() => {
      result.current.mutate({ id: "wb-3" });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData(detailKey)).toBeUndefined();
    });
  });

  it("invalidates workbooks query on settled", async () => {
    server.mount(orpcContract.workbooks.deleteWorkbook, { status: 204 });

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useWorkbookDelete(), { queryClient });

    act(() => {
      result.current.mutate({ id: "wb-1" });
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: orpc.workbooks.listWorkbooks.key() }),
      );
    });
  });
});
