import { renderHook } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { useExperimentAccess } from "./useExperimentAccess";

const mockUseQuery = vi.fn();

vi.mock("@/lib/tsr", () => ({
  tsr: {
    experiments: {
      getExperimentAccess: { useQuery: (...args: unknown[]) => mockUseQuery(...args) },
    },
  },
}));

describe("useExperimentAccess", () => {
  it("passes correct query params and key", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true, error: null });

    renderHook(() => useExperimentAccess("exp-123"));

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: { params: { id: "exp-123" } },
      queryKey: ["experimentAccess", "exp-123"],
      retry: expect.any(Function),
    });
  });

  it("returns query result directly", () => {
    const mockData = { status: 200, body: { hasAccess: true, isAdmin: false } };
    mockUseQuery.mockReturnValue({ data: mockData, isLoading: false, error: null });

    const { result } = renderHook(() => useExperimentAccess("exp-123"));

    expect(result.current.data).toEqual(mockData);
    expect(result.current.isLoading).toBe(false);
  });
});
