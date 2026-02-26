import { createMacro } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api";

import { useMacroUpdate } from "./useMacroUpdate";

describe("useMacroUpdate", () => {
  it("should send an update request via MSW", async () => {
    const updatedMacro = createMacro({
      id: "test-macro-id",
      name: "Updated Name",
      description: "Updated Description",
    });

    const spy = server.mount(contract.macros.updateMacro, {
      body: updatedMacro,
    });

    const { result } = renderHook(() => useMacroUpdate("test-macro-id"));

    act(() => {
      result.current.mutate({
        params: { id: "test-macro-id" },
        body: { name: "Updated Name", description: "Updated Description" },
      });
    });

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.calls[0].params).toEqual({ id: "test-macro-id" });
    expect(spy.calls[0].body).toMatchObject({
      name: "Updated Name",
      description: "Updated Description",
    });
  });

  it("should call onSuccess callback with the updated macro", async () => {
    const updatedMacro = createMacro({
      id: "test-macro-id",
      name: "Updated Macro",
    });

    server.mount(contract.macros.updateMacro, { body: updatedMacro });

    let successData: unknown = null;
    const { result } = renderHook(() =>
      useMacroUpdate("test-macro-id", {
        onSuccess: (macro) => {
          successData = macro;
        },
      }),
    );

    act(() => {
      result.current.mutate({
        params: { id: "test-macro-id" },
        body: { name: "Updated Macro" },
      });
    });

    await waitFor(() => {
      expect(successData).not.toBeNull();
    });

    expect(successData).toMatchObject({ id: updatedMacro.id, name: "Updated Macro" });
  });

  it("should return idle mutation state initially", () => {
    server.mount(contract.macros.updateMacro, {
      body: createMacro({ id: "test-macro-id" }),
    });

    const { result } = renderHook(() => useMacroUpdate("test-macro-id"));

    expect(result.current.isPending).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should handle server error", async () => {
    server.mount(contract.macros.updateMacro, { status: 500 });

    const { result } = renderHook(() => useMacroUpdate("test-macro-id"));

    act(() => {
      result.current.mutate({
        params: { id: "test-macro-id" },
        body: { name: "Will Fail" },
      });
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(result.current.error).not.toBeNull();
  });
});
