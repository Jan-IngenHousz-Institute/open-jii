import { tsr } from "@/lib/tsr";
import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useExperimentMetadata } from "./useExperimentMetadata";

vi.mock("@/lib/tsr", () => ({
  tsr: {
    experiments: {
      listExperimentMetadata: {
        useQuery: vi.fn(),
      },
    },
  },
}));

const mockTsr = tsr as ReturnType<typeof vi.mocked<typeof tsr>>;

describe("useExperimentMetadata", () => {
  const mockExperimentId = "test-experiment-id";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call useQuery with correct parameters", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: [] },
      isLoading: false,
      error: null,
    });
    mockTsr.experiments.listExperimentMetadata.useQuery = mockUseQuery;

    renderHook(() => useExperimentMetadata(mockExperimentId));

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: { params: { id: mockExperimentId } },
      queryKey: ["experiment", mockExperimentId, "metadata"],
    });
  });

  it("should return the query result directly", () => {
    const mockReturnValue = {
      data: {
        body: [
          {
            metadataId: "meta-uuid",
            experimentId: mockExperimentId,
            metadata: { location: "Lab A" },
            createdBy: "user-uuid",
            createdAt: "2025-01-01T00:00:00.000Z",
            updatedAt: "2025-01-02T00:00:00.000Z",
          },
        ],
      },
      isLoading: false,
      error: null,
    };

    const mockUseQuery = vi.fn().mockReturnValue(mockReturnValue);
    mockTsr.experiments.listExperimentMetadata.useQuery = mockUseQuery;

    const { result } = renderHook(() => useExperimentMetadata(mockExperimentId));

    expect(result.current.data).toEqual(mockReturnValue.data);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should handle loading state", () => {
    const mockReturnValue = {
      data: undefined,
      isLoading: true,
      error: null,
    };

    const mockUseQuery = vi.fn().mockReturnValue(mockReturnValue);
    mockTsr.experiments.listExperimentMetadata.useQuery = mockUseQuery;

    const { result } = renderHook(() => useExperimentMetadata(mockExperimentId));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeNull();
  });

  it("should handle error state", () => {
    const mockError = new Error("Failed to fetch metadata");
    const mockReturnValue = {
      data: undefined,
      isLoading: false,
      error: mockError,
    };

    const mockUseQuery = vi.fn().mockReturnValue(mockReturnValue);
    mockTsr.experiments.listExperimentMetadata.useQuery = mockUseQuery;

    const { result } = renderHook(() => useExperimentMetadata(mockExperimentId));

    expect(result.current.error).toBe(mockError);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it("should handle empty metadata response (no metadata exists)", () => {
    const mockReturnValue = {
      data: { body: [] },
      isLoading: false,
      error: null,
    };

    const mockUseQuery = vi.fn().mockReturnValue(mockReturnValue);
    mockTsr.experiments.listExperimentMetadata.useQuery = mockUseQuery;

    const { result } = renderHook(() => useExperimentMetadata(mockExperimentId));

    expect(result.current.data?.body).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should pass through experiment ID correctly", () => {
    const differentExperimentId = "another-experiment-id";
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: [] },
      isLoading: false,
      error: null,
    });
    mockTsr.experiments.listExperimentMetadata.useQuery = mockUseQuery;

    renderHook(() => useExperimentMetadata(differentExperimentId));

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: { params: { id: differentExperimentId } },
      queryKey: ["experiment", differentExperimentId, "metadata"],
    });
  });
});
