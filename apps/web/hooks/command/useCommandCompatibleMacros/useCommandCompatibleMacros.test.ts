import { createMacro } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useCommandCompatibleMacros } from "./useCommandCompatibleMacros";

describe("useCommandCompatibleMacros", () => {
  it("returns compatible macros for a command", async () => {
    server.mount(contract.commands.listCompatibleMacros, {
      body: [
        {
          commandId: "command-1",
          macro: createMacro({ filename: "macro_a.py" }),
          addedAt: "2025-01-01T00:00:00.000Z",
        },
      ],
    });

    const { result } = renderHook(() => useCommandCompatibleMacros("command-1"));

    await waitFor(() => {
      expect(result.current.data?.body).toHaveLength(1);
    });

    expect(result.current.data?.body[0]?.macro.filename).toBe("macro_a.py");
  });

  it("does not fetch when commandId is empty", () => {
    const spy = server.mount(contract.commands.listCompatibleMacros, { body: [] });

    renderHook(() => useCommandCompatibleMacros(""));

    expect(spy.calls).toHaveLength(0);
  });

  it("does not fetch when explicitly disabled", () => {
    const spy = server.mount(contract.commands.listCompatibleMacros, { body: [] });

    renderHook(() => useCommandCompatibleMacros("command-1", false));

    expect(spy.calls).toHaveLength(0);
  });
});
