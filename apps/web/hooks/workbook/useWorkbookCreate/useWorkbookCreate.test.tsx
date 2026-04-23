import { createWorkbook } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act, createTestQueryClient } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api";

import { useWorkbookCreate } from "./useWorkbookCreate";

describe("useWorkbookCreate", () => {
  it("calls POST /workbooks and invokes onSuccess", async () => {
    server.mount(contract.workbooks.createWorkbook, {
      body: createWorkbook({ id: "wb-1", name: "New WB" }),
    });

    const onSuccess = vi.fn();
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["workbooks"], { body: [] });

    const { result } = renderHook(() => useWorkbookCreate({ onSuccess }), { queryClient });

    act(() => {
      result.current.mutate({
        body: { name: "New WB", description: "Desc", cells: [] },
      });
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
      expect((onSuccess.mock.calls[0][0] as { body: { id: string } }).body.id).toBe("wb-1");
    });
  });

  it("captures the request body sent to the API", async () => {
    const spy = server.mount(contract.workbooks.createWorkbook, {
      body: createWorkbook({ id: "wb-2", name: "Test" }),
    });

    const { result } = renderHook(() => useWorkbookCreate());

    act(() => {
      result.current.mutate({
        body: { name: "Test", description: "A desc", cells: [] },
      });
    });

    await waitFor(() => {
      expect(spy.body).toMatchObject({ name: "Test", description: "A desc" });
    });
  });

  it("calls onError when the API returns an error", async () => {
    server.mount(contract.workbooks.createWorkbook, { status: 400 });

    const onError = vi.fn();
    const { result } = renderHook(() => useWorkbookCreate({ onError }));

    act(() => {
      result.current.mutate({ body: { name: "", description: "", cells: [] } });
    });

    await waitFor(() => {
      expect(onError).toHaveBeenCalled();
    });
  });

  it("invalidates workbooks query cache on success", async () => {
    server.mount(contract.workbooks.createWorkbook, {
      body: createWorkbook({ id: "wb-3" }),
    });

    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["workbooks"], { body: [] });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useWorkbookCreate(), { queryClient });

    act(() => {
      result.current.mutate({ body: { name: "WB", description: "", cells: [] } });
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ["workbooks"] }),
      );
    });
  });
});
