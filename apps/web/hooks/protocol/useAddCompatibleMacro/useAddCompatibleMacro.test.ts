import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api";

import { useAddCompatibleMacro } from "./useAddCompatibleMacro";

describe("useAddCompatibleMacro", () => {
  it("sends add request with macro IDs", async () => {
    const spy = server.mount(contract.protocols.addCompatibleMacros, {
      body: [],
    });

    const { result } = renderHook(() => useAddCompatibleMacro("protocol-1"));

    act(() => {
      result.current.mutate({
        body: { macroIds: ["m-1", "m-2"] },
        params: { id: "protocol-1" },
      });
    });

    await waitFor(() => {
      expect(spy.body).toMatchObject({ macroIds: ["m-1", "m-2"] });
    });
  });

  it("completes mutation successfully", async () => {
    server.mount(contract.protocols.addCompatibleMacros, { body: [] });

    const { result } = renderHook(() => useAddCompatibleMacro("protocol-1"));

    act(() => {
      result.current.mutate({
        body: { macroIds: ["m-1"] },
        params: { id: "protocol-1" },
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });
});
