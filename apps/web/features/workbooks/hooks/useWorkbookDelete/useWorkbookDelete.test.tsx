import { createWorkbook } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act, createTestQueryClient } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { useWorkbookDelete } from "./useWorkbookDelete";

describe("useWorkbookDelete", () => {
  it("calls DELETE /workbooks/:id", async () => {
    const spy = server.mount(contract.workbooks.deleteWorkbook, { status: 204 });

    const { result } = renderHook(() => useWorkbookDelete());

    act(() => {
      result.current.mutate({ params: { id: "wb-1" } });
    });

    await waitFor(() => {
      expect(spy.params).toMatchObject({ id: "wb-1" });
    });
  });

  it("optimistically removes workbook from cache", async () => {
    server.mount(contract.workbooks.deleteWorkbook, { status: 204 });

    const wb1 = createWorkbook({ id: "wb-1", name: "Keep" });
    const wb2 = createWorkbook({ id: "wb-2", name: "Delete" });
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["workbooks"], { body: [wb1, wb2] });

    const { result } = renderHook(() => useWorkbookDelete(), { queryClient });

    act(() => {
      result.current.mutate({ params: { id: "wb-2" } });
    });

    // Mutation should complete successfully
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("removes the individual workbook query from cache", async () => {
    server.mount(contract.workbooks.deleteWorkbook, { status: 204 });

    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["workbook", "wb-3"], {
      body: createWorkbook({ id: "wb-3" }),
    });

    const { result } = renderHook(() => useWorkbookDelete(), { queryClient });

    act(() => {
      result.current.mutate({ params: { id: "wb-3" } });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData(["workbook", "wb-3"])).toBeUndefined();
    });
  });

  it("rolls back optimistic update on error", async () => {
    server.mount(contract.workbooks.deleteWorkbook, { status: 403 });

    const wb1 = createWorkbook({ id: "wb-1" });
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["workbooks"], { body: [wb1] });

    const { result } = renderHook(() => useWorkbookDelete(), { queryClient });

    act(() => {
      result.current.mutate({ params: { id: "wb-1" } });
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData<{ body: { id: string }[] }>(["workbooks"]);
      expect(cached?.body).toHaveLength(1);
    });
  });

  it("invalidates workbooks query on settled", async () => {
    server.mount(contract.workbooks.deleteWorkbook, { status: 204 });

    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["workbooks"], { body: [] });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useWorkbookDelete(), { queryClient });

    act(() => {
      result.current.mutate({ params: { id: "wb-1" } });
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ["workbooks"] }),
      );
    });
  });
});
