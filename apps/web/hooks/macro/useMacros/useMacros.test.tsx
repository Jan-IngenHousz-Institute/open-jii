import { renderHook } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { useMacros } from "./useMacros";

const mockUseQuery = vi.fn();

vi.mock("../../../lib/tsr", () => ({
  tsr: {
    macros: {
      listMacros: { useQuery: (...args: unknown[]) => mockUseQuery(...args) },
    },
  },
}));

describe("useMacros", () => {
  it("passes empty filter by default", () => {
    mockUseQuery.mockReturnValue({ data: { body: [] }, isLoading: false, error: null });

    renderHook(() => useMacros());

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: { query: {} },
      queryKey: ["macros", undefined],
    });
  });

  it("passes provided filter", () => {
    const filter = { search: "test", language: "python" as const };
    mockUseQuery.mockReturnValue({ data: { body: [] }, isLoading: false, error: null });

    renderHook(() => useMacros(filter));

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: { query: filter },
      queryKey: ["macros", filter],
    });
  });

  it("returns unwrapped data, isLoading, error", () => {
    const macros = [{ id: "1", name: "M1" }];
    mockUseQuery.mockReturnValue({ data: { body: macros }, isLoading: false, error: null });

    const { result } = renderHook(() => useMacros());

    expect(result.current.data).toEqual(macros);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
