import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useRemoveCompatibleMacro } from "./useRemoveCompatibleMacro";

describe("useRemoveCompatibleMacro", () => {
  it("sends delete request with correct params", async () => {
    const spy = server.mount(contract.commands.removeCompatibleMacro);

    const { result } = renderHook(() => useRemoveCompatibleMacro("command-1"));

    act(() => {
      result.current.mutate({
        params: { id: "command-1", macroId: "m-1" },
      });
    });

    await waitFor(() => {
      expect(spy.params.id).toBe("command-1");
      expect(spy.params.macroId).toBe("m-1");
    });
  });

  it("completes mutation successfully", async () => {
    server.mount(contract.commands.removeCompatibleMacro);

    const { result } = renderHook(() => useRemoveCompatibleMacro("command-1"));

    act(() => {
      result.current.mutate({
        params: { id: "command-1", macroId: "m-1" },
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });
});
