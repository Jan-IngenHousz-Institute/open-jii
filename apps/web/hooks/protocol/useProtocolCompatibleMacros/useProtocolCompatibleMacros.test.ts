import { createMacro } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { orpcContract } from "@repo/api/orpc-contract";

import { useProtocolCompatibleMacros } from "./useProtocolCompatibleMacros";

describe("useProtocolCompatibleMacros", () => {
  it("returns compatible macros for a protocol", async () => {
    server.mount(orpcContract.protocols.listCompatibleMacros, {
      body: [
        {
          protocolId: "protocol-1",
          macro: createMacro({ filename: "macro_a.py" }),
          addedAt: "2025-01-01T00:00:00.000Z",
        },
      ],
    });

    const { result } = renderHook(() => useProtocolCompatibleMacros("protocol-1"));

    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
    });

    expect(result.current.data?.[0]?.macro.filename).toBe("macro_a.py");
  });

  it("does not fetch when protocolId is empty", () => {
    const spy = server.mount(orpcContract.protocols.listCompatibleMacros, { body: [] });

    renderHook(() => useProtocolCompatibleMacros(""));

    expect(spy.calls).toHaveLength(0);
  });

  it("does not fetch when explicitly disabled", () => {
    const spy = server.mount(orpcContract.protocols.listCompatibleMacros, { body: [] });

    renderHook(() => useProtocolCompatibleMacros("protocol-1", false));

    expect(spy.calls).toHaveLength(0);
  });
});
