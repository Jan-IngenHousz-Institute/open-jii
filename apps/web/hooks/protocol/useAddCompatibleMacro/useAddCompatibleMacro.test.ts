import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { orpcContract } from "@repo/api/orpc-contract";

import { useAddCompatibleMacro } from "./useAddCompatibleMacro";

describe("useAddCompatibleMacro", () => {
  it("sends add request with macro IDs", async () => {
    const spy = server.mount(orpcContract.protocols.addCompatibleMacros, {
      body: [],
    });

    const { result } = renderHook(() => useAddCompatibleMacro("protocol-1"));

    act(() => {
      result.current.mutate({
        id: "protocol-1",
        macroIds: ["m-1", "m-2"],
      });
    });

    await waitFor(() => {
      expect(spy.body).toMatchObject({ macroIds: ["m-1", "m-2"] });
    });
  });

  it("completes mutation successfully", async () => {
    server.mount(orpcContract.protocols.addCompatibleMacros, { body: [] });

    const { result } = renderHook(() => useAddCompatibleMacro("protocol-1"));

    act(() => {
      result.current.mutate({
        id: "protocol-1",
        macroIds: ["m-1"],
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });
});
