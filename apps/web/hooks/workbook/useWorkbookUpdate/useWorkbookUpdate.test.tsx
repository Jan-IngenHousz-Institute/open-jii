import { orpc } from "@/lib/orpc";
import { createWorkbook } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act, createTestQueryClient } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { useWorkbookUpdate } from "./useWorkbookUpdate";

describe("useWorkbookUpdate", () => {
  it("calls PATCH /workbooks/:id with the body", async () => {
    const spy = server.mount(contract.workbooks.updateWorkbook, {
      body: createWorkbook({ id: "wb-1", name: "Updated" }),
    });

    const { result } = renderHook(() => useWorkbookUpdate("wb-1"));

    act(() => {
      result.current.mutate({ id: "wb-1", name: "Updated" });
    });

    await waitFor(() => {
      expect(spy.body).toMatchObject({ name: "Updated" });
    });
  });

  it("invokes onSuccess callback with the workbook", async () => {
    server.mount(contract.workbooks.updateWorkbook, {
      body: createWorkbook({ id: "wb-1", name: "Updated" }),
    });

    const onSuccess = vi.fn();
    const { result } = renderHook(() => useWorkbookUpdate("wb-1", { onSuccess }));

    act(() => {
      result.current.mutate({ id: "wb-1", name: "Updated" });
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ id: "wb-1", name: "Updated" }),
      );
    });
  });

  it("optimistically updates the workbook detail cache", async () => {
    server.mount(contract.workbooks.updateWorkbook, {
      body: createWorkbook({ id: "wb-1", name: "Updated" }),
    });

    const detailKey = orpc.workbooks.getWorkbook.queryKey({ input: { id: "wb-1" } });
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(detailKey, createWorkbook({ id: "wb-1", name: "Original" }));

    const { result } = renderHook(() => useWorkbookUpdate("wb-1"), { queryClient });

    act(() => {
      result.current.mutate({ id: "wb-1", name: "Updated" });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("rolls back the detail cache on error", async () => {
    server.mount(contract.workbooks.updateWorkbook, { status: 400 });

    const detailKey = orpc.workbooks.getWorkbook.queryKey({ input: { id: "wb-1" } });
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(detailKey, createWorkbook({ id: "wb-1", name: "Original" }));

    const { result } = renderHook(() => useWorkbookUpdate("wb-1"), { queryClient });

    act(() => {
      result.current.mutate({ id: "wb-1", name: "Should Fail" });
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData<{ name: string }>(detailKey);
      expect(cached?.name).toBe("Original");
    });
  });
});
