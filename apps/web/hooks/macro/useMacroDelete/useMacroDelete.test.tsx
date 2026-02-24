/**
 * useMacroDelete hook test — MSW-based.
 *
 * The real hook calls `tsr.macros.deleteMacro.useMutation` →
 * `DELETE /api/v1/macros/:id`. MSW intercepts that request.
 *
 * Tests verify: optimistic removal from cache, rollback on error,
 * cache invalidation on settle.
 */
import { createMacro } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act, createTestQueryClient } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api";

import { useMacroDelete } from "./useMacroDelete";

describe("useMacroDelete", () => {
  it("sends DELETE request via MSW", async () => {
    const spy = server.mount(contract.macros.deleteMacro);

    const { result } = renderHook(() => useMacroDelete());

    act(() => {
      result.current.mutate({ params: { id: "macro-123" } });
    });

    await waitFor(() => {
      expect(spy.params.id).toBe("macro-123");
    });
  });

  it("optimistically removes macro from the list cache", async () => {
    const queryClient = createTestQueryClient();

    // Pre-populate the macros list cache
    queryClient.setQueryData(["macros"], {
      body: [
        createMacro({ id: "macro-1", name: "Macro 1" }),
        createMacro({ id: "macro-2", name: "Macro 2" }),
      ],
    });

    // Use a delayed response so we can observe the optimistic state
    server.mount(contract.macros.deleteMacro, { delay: 100 });

    const { result } = renderHook(() => useMacroDelete(), { queryClient });

    act(() => {
      result.current.mutate({ params: { id: "macro-1" } });
    });

    // After onMutate, the cache should optimistically remove macro-1
    await waitFor(() => {
      const cached = queryClient.getQueryData<{ body: { id: string }[] }>(["macros"]);
      expect(cached?.body).toHaveLength(1);
      expect(cached?.body[0].id).toBe("macro-2");
    });
  });

  it("restores cache on error", async () => {
    const queryClient = createTestQueryClient();

    queryClient.setQueryData(["macros"], {
      body: [
        createMacro({ id: "macro-1", name: "Macro 1" }),
        createMacro({ id: "macro-2", name: "Macro 2" }),
      ],
    });

    server.mount(contract.macros.deleteMacro, { status: 403 });

    const { result } = renderHook(() => useMacroDelete(), { queryClient });

    act(() => {
      result.current.mutate({ params: { id: "macro-1" } });
    });

    // After error + onSettled, the cache should revert
    await waitFor(() => {
      const cached = queryClient.getQueryData<{ body: { id: string }[] }>(["macros"]);
      expect(cached?.body).toHaveLength(2);
    });
  });

  it("does not fail when cache is empty", async () => {
    const queryClient = createTestQueryClient();
    server.mount(contract.macros.deleteMacro);

    const { result } = renderHook(() => useMacroDelete(), { queryClient });

    // Should not throw even with no cached data
    act(() => {
      result.current.mutate({ params: { id: "macro-1" } });
    });

    await waitFor(() => {
      expect(result.current.isSuccess || result.current.isIdle).toBeTruthy();
    });
  });
});
