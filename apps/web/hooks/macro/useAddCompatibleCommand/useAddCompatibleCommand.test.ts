import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useAddCompatibleCommand } from "./useAddCompatibleCommand";

describe("useAddCompatibleCommand", () => {
  it("sends add request with command IDs", async () => {
    const spy = server.mount(contract.macros.addCompatibleCommands, {
      body: [],
    });

    const { result } = renderHook(() => useAddCompatibleCommand("macro-1"));

    act(() => {
      result.current.mutate({
        body: { commandIds: ["p-1", "p-2"] },
        params: { id: "macro-1" },
      });
    });

    await waitFor(() => {
      expect(spy.body).toMatchObject({ commandIds: ["p-1", "p-2"] });
    });
  });

  it("completes mutation successfully", async () => {
    server.mount(contract.macros.addCompatibleCommands, { body: [] });

    const { result } = renderHook(() => useAddCompatibleCommand("macro-1"));

    act(() => {
      result.current.mutate({
        body: { commandIds: ["p-1"] },
        params: { id: "macro-1" },
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });
});
