import { createMacro } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useMacroRestore } from "./useMacroRestore";

describe("useMacroRestore", () => {
  it("posts a restore request for the chosen version", async () => {
    const restored = createMacro({ id: "m-1", name: "Restored" });
    const spy = server.mount(contract.macros.restoreMacroVersion, { body: restored });

    const { result } = renderHook(() => useMacroRestore("m-1"));

    act(() => {
      result.current.mutate({ params: { id: "m-1", version: 1 } });
    });

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.calls[0].params.id).toBe("m-1");
    expect(result.current.data?.body).toMatchObject({ id: "m-1" });
  });

  it("surfaces a server error", async () => {
    server.mount(contract.macros.restoreMacroVersion, { status: 404 });

    const { result } = renderHook(() => useMacroRestore("m-1"));

    act(() => {
      result.current.mutate({ params: { id: "m-1", version: 99 } });
    });

    await waitFor(() => expect(result.current.error).not.toBeNull());
  });
});
