import { orpc } from "@/lib/orpc";
import { createMacroDetail } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act, createTestQueryClient } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { useMacroDelete } from "./useMacroDelete";

describe("useMacroDelete", () => {
  it("sends DELETE request", async () => {
    const spy = server.mount(contract.macros.deleteMacro);

    const { result } = renderHook(() => useMacroDelete());

    act(() => {
      result.current.mutate({ id: "macro-123" });
    });

    await waitFor(() => {
      expect(spy.params.id).toBe("macro-123");
    });
  });

  it("removes the deleted macro's detail cache", async () => {
    const queryClient = createTestQueryClient();
    const detailKey = orpc.macros.getMacro.queryKey({ input: { id: "macro-1" } });

    queryClient.setQueryData(detailKey, createMacroDetail({ id: "macro-1" }));

    server.mount(contract.macros.deleteMacro);

    const { result } = renderHook(() => useMacroDelete(), { queryClient });

    act(() => {
      result.current.mutate({ id: "macro-1" });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(queryClient.getQueryData(detailKey)).toBeUndefined();
  });

  it("does not fail when cache is empty", async () => {
    const queryClient = createTestQueryClient();
    server.mount(contract.macros.deleteMacro);

    const { result } = renderHook(() => useMacroDelete(), { queryClient });

    // Should not throw even with no cached data
    act(() => {
      result.current.mutate({ id: "macro-1" });
    });

    await waitFor(() => {
      expect(result.current.isSuccess || result.current.isIdle).toBeTruthy();
    });
  });

  it("invalidates both the unpaginated and paginated list caches on settled", async () => {
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    server.mount(contract.macros.deleteMacro);

    const { result } = renderHook(() => useMacroDelete(), { queryClient });

    act(() => {
      result.current.mutate({ id: "macro-1" });
    });

    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: orpc.macros.listMacros.key(),
      });
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: orpc.macros.listMacrosPaginated.key(),
      });
    });
  });
});
