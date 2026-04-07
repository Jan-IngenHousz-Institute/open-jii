import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api";

import { useAddCompatibleProtocol } from "./useAddCompatibleProtocol";

describe("useAddCompatibleProtocol", () => {
  it("sends add request with protocol IDs", async () => {
    const spy = server.mount(contract.macros.addCompatibleProtocols, {
      body: [],
    });

    const { result } = renderHook(() => useAddCompatibleProtocol("macro-1"));

    act(() => {
      result.current.mutate({
        body: { protocolIds: ["p-1", "p-2"] },
        params: { id: "macro-1" },
      });
    });

    await waitFor(() => {
      expect(spy.body).toMatchObject({ protocolIds: ["p-1", "p-2"] });
    });
  });

  it("completes mutation successfully", async () => {
    server.mount(contract.macros.addCompatibleProtocols, { body: [] });

    const { result } = renderHook(() => useAddCompatibleProtocol("macro-1"));

    act(() => {
      result.current.mutate({
        body: { protocolIds: ["p-1"] },
        params: { id: "macro-1" },
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });
});
