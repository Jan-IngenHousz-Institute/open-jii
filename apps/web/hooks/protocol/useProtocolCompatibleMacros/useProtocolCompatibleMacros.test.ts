import { tsr } from "@/lib/tsr";
import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useProtocolCompatibleMacros } from "./useProtocolCompatibleMacros";

// Mock the tsr module
vi.mock("@/lib/tsr", () => ({
  tsr: {
    protocols: {
      listCompatibleMacros: {
        useQuery: vi.fn(),
      },
    },
  },
}));

const mockTsr = tsr as ReturnType<typeof vi.mocked<typeof tsr>>;

describe("useProtocolCompatibleMacros", () => {
  const mockProtocolId = "test-protocol-id";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call useQuery with correct parameters", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: [] },
      isLoading: false,
    });
    mockTsr.protocols.listCompatibleMacros.useQuery = mockUseQuery;

    renderHook(() => useProtocolCompatibleMacros(mockProtocolId));

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: { params: { id: mockProtocolId } },
      queryKey: ["protocol-compatible-macros", mockProtocolId],
      enabled: true,
    });
  });

  it("should pass enabled: false when protocolId is empty string", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      isLoading: false,
    });
    mockTsr.protocols.listCompatibleMacros.useQuery = mockUseQuery;

    renderHook(() => useProtocolCompatibleMacros(""));

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: { params: { id: "" } },
      queryKey: ["protocol-compatible-macros", ""],
      enabled: false,
    });
  });

  it("should pass enabled: false when enabled param is explicitly false", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      isLoading: false,
    });
    mockTsr.protocols.listCompatibleMacros.useQuery = mockUseQuery;

    renderHook(() => useProtocolCompatibleMacros(mockProtocolId, false));

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: { params: { id: mockProtocolId } },
      queryKey: ["protocol-compatible-macros", mockProtocolId],
      enabled: false,
    });
  });

  it("should return the query result", () => {
    const mockBody = [
      { macro: { id: "macro-1", name: "Macro A", language: "python" } },
      { macro: { id: "macro-2", name: "Macro B", language: "r" } },
    ];
    const mockReturnValue = {
      data: { body: mockBody },
      isLoading: false,
    };

    const mockUseQuery = vi.fn().mockReturnValue(mockReturnValue);
    mockTsr.protocols.listCompatibleMacros.useQuery = mockUseQuery;

    const { result } = renderHook(() => useProtocolCompatibleMacros(mockProtocolId));

    expect(result.current.data?.body).toEqual(mockBody);
    expect(result.current.isLoading).toBe(false);
  });

  it("should handle loading state", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    mockTsr.protocols.listCompatibleMacros.useQuery = mockUseQuery;

    const { result } = renderHook(() => useProtocolCompatibleMacros(mockProtocolId));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });
});
