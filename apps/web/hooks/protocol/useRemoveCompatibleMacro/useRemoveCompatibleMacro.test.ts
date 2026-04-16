import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api";

import { useRemoveCompatibleMacro } from "./useRemoveCompatibleMacro";

describe("useRemoveCompatibleMacro", () => {
  it("sends delete request with correct params", async () => {
    const spy = server.mount(contract.protocols.removeCompatibleMacro);

    const { result } = renderHook(() => useRemoveCompatibleMacro("protocol-1"));

    act(() => {
      result.current.mutate({
        params: { id: "protocol-1", macroId: "m-1" },
      });
    });

    await waitFor(() => {
      expect(spy.params.id).toBe("protocol-1");
      expect(spy.params.macroId).toBe("m-1");
    });
  });

  it("completes mutation successfully", async () => {
    server.mount(contract.protocols.removeCompatibleMacro);

    const { result } = renderHook(() => useRemoveCompatibleMacro("protocol-1"));

    act(() => {
      result.current.mutate({
        params: { id: "protocol-1", macroId: "m-1" },
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });
});
