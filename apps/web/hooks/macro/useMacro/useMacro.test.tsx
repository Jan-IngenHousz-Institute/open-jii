import { renderHook } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { useMacro } from "./useMacro";

const mockUseQuery = vi.fn();

vi.mock("../../../lib/tsr", () => ({
  tsr: {
    macros: {
      getMacro: { useQuery: (...args: unknown[]) => mockUseQuery(...args) },
    },
  },
}));

describe("useMacro", () => {
  it("passes correct params and query key", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true, error: null });

    renderHook(() => useMacro("m-1"));

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: { params: { id: "m-1" } },
      queryKey: ["macro", "m-1"],
      retry: expect.any(Function),
    });
  });

  it("returns unwrapped data, isLoading, error", () => {
    const macro = { id: "m-1", name: "Test" };
    mockUseQuery.mockReturnValue({ data: { body: macro }, isLoading: false, error: null });

    const { result } = renderHook(() => useMacro("m-1"));

    expect(result.current.data).toEqual(macro);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("returns error when query fails", () => {
    const err = new Error("fail");
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false, error: err });

    const { result } = renderHook(() => useMacro("m-1"));

    expect(result.current.error).toBe(err);
    expect(result.current.data).toBeUndefined();
  });
});
