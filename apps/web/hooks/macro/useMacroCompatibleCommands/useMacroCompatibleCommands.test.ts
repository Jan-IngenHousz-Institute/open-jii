import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useMacroCompatibleCommands } from "./useMacroCompatibleCommands";

describe("useMacroCompatibleCommands", () => {
  it("returns compatible commands for a macro", async () => {
    server.mount(contract.macros.listCompatibleCommands, {
      body: [
        {
          macroId: "macro-1",
          command: { id: "p-1", name: "Command A", family: "multispeq", createdBy: "user-1" },
          addedAt: "2025-01-01T00:00:00.000Z",
        },
      ],
    });

    const { result } = renderHook(() => useMacroCompatibleCommands("macro-1"));

    await waitFor(() => {
      expect(result.current.data?.body).toHaveLength(1);
    });

    expect(result.current.data?.body[0]?.command.name).toBe("Command A");
  });

  it("does not fetch when macroId is empty", () => {
    const spy = server.mount(contract.macros.listCompatibleCommands, { body: [] });

    renderHook(() => useMacroCompatibleCommands(""));

    expect(spy.calls).toHaveLength(0);
  });

  it("does not fetch when explicitly disabled", () => {
    const spy = server.mount(contract.macros.listCompatibleCommands, { body: [] });

    renderHook(() => useMacroCompatibleCommands("macro-1", false));

    expect(spy.calls).toHaveLength(0);
  });
});
