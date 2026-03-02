import { tsr } from "@/lib/tsr";
import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useMacroCompatibleProtocols } from "./useMacroCompatibleProtocols";

// Mock the tsr module
vi.mock("@/lib/tsr", () => ({
  tsr: {
    macros: {
      listCompatibleProtocols: {
        useQuery: vi.fn(),
      },
    },
  },
}));

const mockTsr = tsr as ReturnType<typeof vi.mocked<typeof tsr>>;

describe("useMacroCompatibleProtocols", () => {
  const mockMacroId = "test-macro-id";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call useQuery with correct parameters", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: [] },
      isLoading: false,
    });
    mockTsr.macros.listCompatibleProtocols.useQuery = mockUseQuery;

    renderHook(() => useMacroCompatibleProtocols(mockMacroId));

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: { params: { id: mockMacroId } },
      queryKey: ["macro-compatible-protocols", mockMacroId],
      enabled: true,
    });
  });

  it("should pass enabled: false when macroId is empty string", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      isLoading: false,
    });
    mockTsr.macros.listCompatibleProtocols.useQuery = mockUseQuery;

    renderHook(() => useMacroCompatibleProtocols(""));

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: { params: { id: "" } },
      queryKey: ["macro-compatible-protocols", ""],
      enabled: false,
    });
  });

  it("should pass enabled: false when enabled param is explicitly false", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      isLoading: false,
    });
    mockTsr.macros.listCompatibleProtocols.useQuery = mockUseQuery;

    renderHook(() => useMacroCompatibleProtocols(mockMacroId, false));

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: { params: { id: mockMacroId } },
      queryKey: ["macro-compatible-protocols", mockMacroId],
      enabled: false,
    });
  });

  it("should return the query result", () => {
    const mockBody = [
      { protocol: { id: "proto-1", name: "Protocol A", family: "multispeq" } },
      { protocol: { id: "proto-2", name: "Protocol B", family: "ambit" } },
    ];
    const mockReturnValue = {
      data: { body: mockBody },
      isLoading: false,
    };

    const mockUseQuery = vi.fn().mockReturnValue(mockReturnValue);
    mockTsr.macros.listCompatibleProtocols.useQuery = mockUseQuery;

    const { result } = renderHook(() => useMacroCompatibleProtocols(mockMacroId));

    expect(result.current.data?.body).toEqual(mockBody);
    expect(result.current.isLoading).toBe(false);
  });

  it("should handle loading state", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    mockTsr.macros.listCompatibleProtocols.useQuery = mockUseQuery;

    const { result } = renderHook(() => useMacroCompatibleProtocols(mockMacroId));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });
});
