/**
 * useProtocol hook test — MSW-based.
 *
 * The real hook calls `tsr.protocols.getProtocol.useQuery` →
 * `GET /api/v1/protocols/:id`. MSW intercepts that request.
 */
import { createProtocol } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api";

import { useProtocol } from "./useProtocol";

describe("useProtocol", () => {
  it("returns protocol data from MSW", async () => {
    const protocol = createProtocol({ id: "protocol-123" });
    server.mount(contract.protocols.getProtocol, { body: protocol });

    const { result } = renderHook(() => useProtocol("protocol-123"));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.body).toMatchObject({
      id: "protocol-123",
      name: protocol.name,
    });
    mockTsr.protocols.getProtocol.useQuery = mockUseQuery as vi.MockedFunction<
      typeof mockTsr.protocols.getProtocol.useQuery
    >;

    renderHook(() => useProtocol("protocol-123"), {
      wrapper: createWrapper(),
    });

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: { params: { id: "protocol-123" } },
      queryKey: ["protocol", "protocol-123"],
      retry: expect.any(Function) as (failureCount: number, error: unknown) => boolean,
      enabled: true,
    });
  });

  it("should return successful protocol data", () => {
    const mockData = {
      status: 200,
      body: {
        id: "protocol-123",
        name: "Test Protocol",
        description: "A test protocol",
      },
    };

    const mockUseQuery = vi.fn().mockReturnValue({
      data: mockData,
      error: null,
      isLoading: false,
    });
    mockTsr.protocols.getProtocol.useQuery = mockUseQuery as vi.MockedFunction<
      typeof mockTsr.protocols.getProtocol.useQuery
    >;

    const { result } = renderHook(() => useProtocol("protocol-123"), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toEqual(mockData);
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

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeNull();
  });

  it("should pass enabled=false when explicitly disabled", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      error: null,
      isLoading: false,
    });
    mockTsr.protocols.getProtocol.useQuery = mockUseQuery as vi.MockedFunction<
      typeof mockTsr.protocols.getProtocol.useQuery
    >;

    renderHook(() => useProtocol("protocol-123", false), {
      wrapper: createWrapper(),
    });

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: { params: { id: "protocol-123" } },
      queryKey: ["protocol", "protocol-123"],
      retry: expect.any(Function) as (failureCount: number, error: unknown) => boolean,
      enabled: false,
    });
  });

  it("should use different query keys for different protocol IDs", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      error: null,
      isLoading: false,
    });
    mockTsr.protocols.getProtocol.useQuery = mockUseQuery as vi.MockedFunction<
      typeof mockTsr.protocols.getProtocol.useQuery
    >;

    const wrapper = createWrapper();

    renderHook(() => useProtocol("protocol-1"), { wrapper });
    renderHook(() => useProtocol("protocol-2"), { wrapper });

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["protocol", "protocol-1"],
      }),
    );

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["protocol", "protocol-2"],
      }),
    );
  });
});
