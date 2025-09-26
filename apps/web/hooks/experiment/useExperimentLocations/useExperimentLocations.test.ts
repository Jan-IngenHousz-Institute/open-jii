import { tsr } from "@/lib/tsr";
import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useExperimentLocations } from "./useExperimentLocations";

// Mock the tsr module
vi.mock("@/lib/tsr", () => ({
  tsr: {
    experiments: {
      getExperimentLocations: {
        useQuery: vi.fn(),
      },
    },
  },
}));

const mockTsr = tsr as ReturnType<typeof vi.mocked<typeof tsr>>;

describe("useExperimentLocations", () => {
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
    mockTsr.experiments.getExperimentLocations.useQuery = mockUseQuery;

    renderHook(() => useExperimentLocations(mockExperimentId));

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: { params: { id: mockExperimentId } },
      queryKey: ["experiment-locations", mockExperimentId],
    });
  });

  it("should return the result from useQuery", () => {
    const mockReturnValue = {
      data: {
        body: [
          {
            id: "location-1",
            name: "Berlin Office",
            latitude: 52.52,
            longitude: 13.405,
            createdAt: "2023-01-01T00:00:00Z",
            updatedAt: "2023-01-01T00:00:00Z",
          },
        ],
      },
      isLoading: false,
      error: null,
    };

    const mockUseQuery = vi.fn().mockReturnValue(mockReturnValue);
    mockTsr.experiments.getExperimentLocations.useQuery = mockUseQuery;

    const { result } = renderHook(() => useExperimentLocations(mockExperimentId));

    expect(result.current).toBe(mockReturnValue);
  });

  it("should handle loading state", () => {
    const mockReturnValue = {
      data: undefined,
      isLoading: true,
      error: null,
    };

    const mockUseQuery = vi.fn().mockReturnValue(mockReturnValue);
    mockTsr.experiments.getExperimentLocations.useQuery = mockUseQuery;

    const { result } = renderHook(() => useExperimentLocations(mockExperimentId));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it("should handle error state", () => {
    const mockError = new Error("Failed to fetch locations");
    const mockReturnValue = {
      data: undefined,
      isLoading: false,
      error: mockError,
    };

    const mockUseQuery = vi.fn().mockReturnValue(mockReturnValue);
    mockTsr.experiments.getExperimentLocations.useQuery = mockUseQuery;

    const { result } = renderHook(() => useExperimentLocations(mockExperimentId));

    expect(result.current.error).toBe(mockError);
    expect(result.current.isLoading).toBe(false);
  });

  it("should pass through experiment ID correctly", () => {
    const differentExperimentId = "another-experiment-id";
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: [] },
      isLoading: false,
      error: null,
    });
    mockTsr.experiments.getExperimentLocations.useQuery = mockUseQuery;

    renderHook(() => useExperimentLocations(differentExperimentId));

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: { params: { id: differentExperimentId } },
      queryKey: ["experiment-locations", differentExperimentId],
    });
  });
});
