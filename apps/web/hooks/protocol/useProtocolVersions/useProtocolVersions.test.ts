import { tsr } from "@/lib/tsr";
import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useProtocolVersions } from "./useProtocolVersions";

vi.mock("@/lib/tsr", () => ({
  tsr: {
    protocols: {
      listProtocolVersions: {
        useQuery: vi.fn(),
      },
    },
  },
}));

const mockTsr = tsr as ReturnType<typeof vi.mocked<typeof tsr>>;

describe("useProtocolVersions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call useQuery with correct parameters", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: [] },
      isLoading: false,
      error: null,
    });
    mockTsr.protocols.listProtocolVersions.useQuery = mockUseQuery;

    renderHook(() => useProtocolVersions("proto-1"));

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: { params: { id: "proto-1" } },
      queryKey: ["protocol-versions", "proto-1"],
      enabled: true,
    });
  });

  it("should return version data", () => {
    const mockVersions = [
      { id: "p1", version: 2, name: "Protocol" },
      { id: "p1", version: 1, name: "Protocol" },
    ];
    mockTsr.protocols.listProtocolVersions.useQuery = vi.fn().mockReturnValue({
      data: { body: mockVersions },
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useProtocolVersions("proto-1"));

    expect(result.current.data).toEqual(mockVersions);
    expect(result.current.isLoading).toBe(false);
  });

  it("should disable query when enabled is false", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });
    mockTsr.protocols.listProtocolVersions.useQuery = mockUseQuery;

    renderHook(() => useProtocolVersions("proto-1", false));

    expect(mockUseQuery).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });
});
