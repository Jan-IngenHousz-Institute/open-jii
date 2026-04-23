import { createWorkbook } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act, createTestQueryClient } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api";

import { useWorkbookUpdate } from "./useWorkbookUpdate";

describe("useWorkbookUpdate", () => {
  it("calls PATCH /workbooks/:id with the body", async () => {
    const spy = server.mount(contract.workbooks.updateWorkbook, {
      body: createWorkbook({ id: "wb-1", name: "Updated" }),
    });

    const { result } = renderHook(() => useWorkbookUpdate("wb-1"));

    act(() => {
      result.current.mutate({
        params: { id: "wb-1" },
        body: { name: "Updated" },
      });
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
      result.current.mutate({
        params: { id: "wb-1" },
        body: { name: "Updated" },
      });
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ id: "wb-1", name: "Updated" }),
      );
    });
  });

  it("optimistically updates the workbook in cache", async () => {
    server.mount(contract.workbooks.updateWorkbook, {
      body: createWorkbook({ id: "wb-1", name: "Updated" }),
    });

    const original = createWorkbook({ id: "wb-1", name: "Original" });
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["workbook", "wb-1"], { body: original });

    const { result } = renderHook(() => useWorkbookUpdate("wb-1"), { queryClient });

    act(() => {
      result.current.mutate({
        params: { id: "wb-1" },
        body: { name: "Updated" },
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("optimistically updates the workbooks list cache", async () => {
    server.mount(contract.workbooks.updateWorkbook, {
      body: createWorkbook({ id: "wb-1", name: "Updated" }),
    });

    const wb1 = createWorkbook({ id: "wb-1", name: "Original" });
    const wb2 = createWorkbook({ id: "wb-2", name: "Other" });
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["workbooks"], { body: [wb1, wb2] });

    const { result } = renderHook(() => useWorkbookUpdate("wb-1"), { queryClient });

    act(() => {
      result.current.mutate({
        params: { id: "wb-1" },
        body: { name: "Updated" },
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("rolls back both caches on error", async () => {
    server.mount(contract.workbooks.updateWorkbook, { status: 400 });

    const original = createWorkbook({ id: "wb-1", name: "Original" });
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["workbook", "wb-1"], { body: original });
    queryClient.setQueryData(["workbooks"], { body: [original] });

    const { result } = renderHook(() => useWorkbookUpdate("wb-1"), { queryClient });

    act(() => {
      result.current.mutate({
        params: { id: "wb-1" },
        body: { name: "Should Fail" },
      });
    });

    await waitFor(() => {
      const cachedSingle = queryClient.getQueryData<{ body: { name: string } }>([
        "workbook",
        "wb-1",
      ]);
      expect(cachedSingle?.body.name).toBe("Original");

      const cachedList = queryClient.getQueryData<{ body: { name: string }[] }>(["workbooks"]);
      expect(cachedList?.body[0].name).toBe("Original");
    });
  });

  it("invalidates breadcrumbs cache on settled", async () => {
    server.mount(contract.workbooks.updateWorkbook, {
      body: createWorkbook({ id: "wb-1" }),
    });

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useWorkbookUpdate("wb-1"), { queryClient });

    act(() => {
      result.current.mutate({
        params: { id: "wb-1" },
        body: { name: "Updated" },
      });
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ["breadcrumbs"] }),
      );
    });
  });
});
