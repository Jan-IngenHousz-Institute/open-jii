import { tsr } from "@/lib/tsr";
import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useMacroVersions } from "./useMacroVersions";

vi.mock("@/lib/tsr", () => ({
  tsr: {
    macros: {
      listMacroVersions: {
        useQuery: vi.fn(),
      },
    },
  },
}));

const mockTsr = tsr as ReturnType<typeof vi.mocked<typeof tsr>>;

describe("useMacroVersions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call useQuery with correct parameters", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: [] },
      isLoading: false,
      error: null,
    });
    mockTsr.macros.listMacroVersions.useQuery = mockUseQuery;

    renderHook(() => useMacroVersions("macro-1"));

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: { params: { id: "macro-1" } },
      queryKey: ["macro-versions", "macro-1"],
      enabled: true,
    });
  });

  it("should return version data", () => {
    const mockVersions = [
      { id: "m1", version: 2, name: "Macro" },
      { id: "m1", version: 1, name: "Macro" },
    ];
    mockTsr.macros.listMacroVersions.useQuery = vi.fn().mockReturnValue({
      data: { body: mockVersions },
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useMacroVersions("macro-1"));

    expect(result.current.data).toEqual(mockVersions);
    expect(result.current.isLoading).toBe(false);
  });

  it("should disable query when enabled is false", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });
    mockTsr.macros.listMacroVersions.useQuery = mockUseQuery;

    renderHook(() => useMacroVersions("macro-1", false));

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    );
  });
});
