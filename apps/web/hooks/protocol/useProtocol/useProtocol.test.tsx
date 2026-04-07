import { createProtocol } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api";

import { useProtocol } from "./useProtocol";

describe("useProtocol", () => {
  it("does not fetch when protocolId is empty", () => {
    const { result } = renderHook(() => useProtocol(""));

    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("should call useQuery with correct parameters", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("handles 404 error for non-existent protocol", async () => {
    server.mount(contract.protocols.getProtocol, { status: 404 });

    const { result } = renderHook(() => useProtocol("non-existent"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data?.body).toBeUndefined();
  });

  it("uses different query keys per protocol ID", async () => {
    server.mount(contract.protocols.getProtocol, { body: createProtocol() });

    // Render same hook with two different IDs — they should fire separate queries
    const { result: r1 } = renderHook(() => useProtocol("p-1"));
    const { result: r2 } = renderHook(() => useProtocol("p-2"));

    await waitFor(() => {
      expect(r1.current.data).toBeDefined();
      expect(r2.current.data).toBeDefined();
    });

    // Both should have resolved independently
    expect(r1.current.isLoading).toBe(false);
    expect(r2.current.isLoading).toBe(false);
  });
});
