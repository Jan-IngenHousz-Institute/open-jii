import { createCommand } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api/contract";

import { useCommand } from "./useCommand";

describe("useCommand", () => {
  it("does not fetch when commandId is empty", () => {
    const { result } = renderHook(() => useCommand(""));

    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("returns command data", async () => {
    const command = createCommand({ id: "command-123" });
    server.mount(contract.commands.getCommand, { body: command });

    const { result } = renderHook(() => useCommand("command-123"));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.body).toMatchObject({
      id: "command-123",
      name: command.name,
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("handles 404 error for non-existent command", async () => {
    server.mount(contract.commands.getCommand, { status: 404 });

    const { result } = renderHook(() => useCommand("non-existent"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data?.body).toBeUndefined();
  });

  it("uses different query keys per command ID", async () => {
    server.mount(contract.commands.getCommand, { body: createCommand() });

    // Render same hook with two different IDs - they should fire separate queries
    const { result: r1 } = renderHook(() => useCommand("p-1"));
    const { result: r2 } = renderHook(() => useCommand("p-2"));

    await waitFor(() => {
      expect(r1.current.data).toBeDefined();
      expect(r2.current.data).toBeDefined();
    });

    // Both should have resolved independently
    expect(r1.current.isLoading).toBe(false);
    expect(r2.current.isLoading).toBe(false);
  });
});
