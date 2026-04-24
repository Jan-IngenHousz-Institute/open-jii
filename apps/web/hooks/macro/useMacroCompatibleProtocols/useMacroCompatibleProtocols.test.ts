import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useMacroCompatibleProtocols } from "./useMacroCompatibleProtocols";

describe("useMacroCompatibleProtocols", () => {
  it("returns compatible protocols for a macro", async () => {
    server.mount(contract.macros.listCompatibleProtocols, {
      body: [
        {
          macroId: "macro-1",
          protocol: { id: "p-1", name: "Protocol A", family: "multispeq", createdBy: "user-1" },
          addedAt: "2025-01-01T00:00:00.000Z",
        },
      ],
    });

    const { result } = renderHook(() => useMacroCompatibleProtocols("macro-1"));

    await waitFor(() => {
      expect(result.current.data?.body).toHaveLength(1);
    });

    expect(result.current.data?.body[0]?.protocol.name).toBe("Protocol A");
  });

  it("does not fetch when macroId is empty", () => {
    const spy = server.mount(contract.macros.listCompatibleProtocols, { body: [] });

    renderHook(() => useMacroCompatibleProtocols(""));

    expect(spy.calls).toHaveLength(0);
  });

  it("does not fetch when explicitly disabled", () => {
    const spy = server.mount(contract.macros.listCompatibleProtocols, { body: [] });

    renderHook(() => useMacroCompatibleProtocols("macro-1", false));

    expect(spy.calls).toHaveLength(0);
  });
});
