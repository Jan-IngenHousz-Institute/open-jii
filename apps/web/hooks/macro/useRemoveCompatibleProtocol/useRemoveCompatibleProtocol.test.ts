import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useRemoveCompatibleProtocol } from "./useRemoveCompatibleProtocol";

describe("useRemoveCompatibleProtocol", () => {
  it("sends delete request with correct params", async () => {
    const spy = server.mount(contract.macros.removeCompatibleProtocol);

    const { result } = renderHook(() => useRemoveCompatibleProtocol("macro-1"));

    act(() => {
      result.current.mutate({
        params: { id: "macro-1", protocolId: "p-1" },
      });
    });

    await waitFor(() => {
      expect(spy.params.id).toBe("macro-1");
      expect(spy.params.protocolId).toBe("p-1");
    });
  });

  it("completes mutation successfully", async () => {
    server.mount(contract.macros.removeCompatibleProtocol);

    const { result } = renderHook(() => useRemoveCompatibleProtocol("macro-1"));

    act(() => {
      result.current.mutate({
        params: { id: "macro-1", protocolId: "p-1" },
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });
});
