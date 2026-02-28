import { createMacro } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act, createTestQueryClient } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api";

import { useMacroCreate } from "./useMacroCreate";

describe("useMacroCreate", () => {
  it("calls POST /macros and invokes onSuccess with id", async () => {
    server.mount(contract.macros.createMacro, {
      body: createMacro({ id: "macro-1" }),
    });

    const onSuccess = vi.fn();
    const queryClient = createTestQueryClient();

    // Pre-populate the macros cache so we can observe invalidation
    queryClient.setQueryData(["macros"], { body: [] });

    const { result } = renderHook(() => useMacroCreate({ onSuccess }), { queryClient });

    act(() => {
      result.current.mutate({ body: { name: "New Macro", language: "python", code: "" } });
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith("macro-1");
    });
  });

  it("captures the request body sent to the API", async () => {
    const spy = server.mount(contract.macros.createMacro, {
      body: createMacro({ id: "macro-2", name: "Test", code: "" }),
    });

    const { result } = renderHook(() => useMacroCreate());

    act(() => {
      result.current.mutate({
        body: { name: "Test", language: "python", code: 'print("hi")' },
      });
    });

    await waitFor(() => {
      expect(spy.body).toMatchObject({ name: "Test", language: "python" });
    });
  });

  it("calls onError when the API returns an error", async () => {
    server.mount(contract.macros.createMacro, { status: 400 });

    const onError = vi.fn();
    const { result } = renderHook(() => useMacroCreate({ onError }));

    act(() => {
      result.current.mutate({ body: { name: "", language: "python", code: "" } });
    });

    await waitFor(() => {
      expect(onError).toHaveBeenCalled();
    });
  });
});
