import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useProtocolCompatibleMacros } from "./useProtocolCompatibleMacros";

describe("useProtocolCompatibleMacros", () => {
  it("returns compatible macros for a protocol", async () => {
    server.mount(contract.protocols.listCompatibleMacros, {
      body: [
        {
          protocolId: "protocol-1",
          macro: { filename: "macro_a.py", language: "python", createdBy: "user-1" },
          addedAt: "2025-01-01T00:00:00.000Z",
        },
      ],
    });

    const { result } = renderHook(() => useProtocolCompatibleMacros("protocol-1"));

    await waitFor(() => {
      expect(result.current.data?.body).toHaveLength(1);
    });

    expect(result.current.data?.body[0]?.macro.filename).toBe("macro_a.py");
  });

  it("does not fetch when protocolId is empty", () => {
    const spy = server.mount(contract.protocols.listCompatibleMacros, { body: [] });

    renderHook(() => useProtocolCompatibleMacros(""));

    expect(spy.calls).toHaveLength(0);
  });

  it("does not fetch when explicitly disabled", () => {
    const spy = server.mount(contract.protocols.listCompatibleMacros, { body: [] });

    renderHook(() => useProtocolCompatibleMacros("protocol-1", false));

    expect(spy.calls).toHaveLength(0);
  });
});
