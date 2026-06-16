import { createProtocol } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useProtocolRestore } from "./useProtocolRestore";

describe("useProtocolRestore", () => {
  it("posts a restore request for the chosen version", async () => {
    const restored = createProtocol({ id: "p-1", name: "Restored" });
    const spy = server.mount(contract.protocols.restoreProtocolVersion, { body: restored });

    const { result } = renderHook(() => useProtocolRestore("p-1"));

    act(() => {
      result.current.mutate({ params: { id: "p-1", version: 1 } });
    });

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.calls[0].params.id).toBe("p-1");
    expect(result.current.data?.body).toMatchObject({ id: "p-1" });
  });

  it("surfaces a server error", async () => {
    server.mount(contract.protocols.restoreProtocolVersion, { status: 404 });

    const { result } = renderHook(() => useProtocolRestore("p-1"));

    act(() => {
      result.current.mutate({ params: { id: "p-1", version: 99 } });
    });

    await waitFor(() => expect(result.current.error).not.toBeNull());
  });
});
