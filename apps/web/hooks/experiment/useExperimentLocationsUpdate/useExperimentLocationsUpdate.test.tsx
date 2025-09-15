/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
import { tsr } from "@/lib/tsr";
import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useExperimentLocationsUpdate } from "./useExperimentLocationsUpdate";

// Mock the tsr module
vi.mock("@/lib/tsr", () => ({
  tsr: {
    useQueryClient: vi.fn(),
    experiments: {
      updateExperimentLocations: {
        useMutation: vi.fn(),
      },
    },
  },
}));

const mockTsr = tsr as ReturnType<typeof vi.mocked<typeof tsr>>;

describe("useExperimentLocationsUpdate", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock useQueryClient to return a mock query client
    mockTsr.useQueryClient.mockReturnValue({
      invalidateQueries: vi.fn(),
    } as any);
  });

  it("should call useMutation with correct parameters", () => {
    const mockUseMutation = vi.fn().mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: null,
    });
    mockTsr.experiments.updateExperimentLocations.useMutation = mockUseMutation;

    renderHook(() => useExperimentLocationsUpdate());

    expect(mockUseMutation).toHaveBeenCalledWith({
      onSuccess: expect.any(Function),
    });
  });

  it("should return mutation result", () => {
    const mockMutationResult = {
      mutate: vi.fn(),
      isPending: false,
      error: null,
      data: undefined,
    };

    const mockUseMutation = vi.fn().mockReturnValue(mockMutationResult);
    mockTsr.experiments.updateExperimentLocations.useMutation = mockUseMutation;

    const { result } = renderHook(() => useExperimentLocationsUpdate());

    expect(result.current).toBe(mockMutationResult);
  });

  it("should handle pending state", () => {
    const mockMutationResult = {
      mutate: vi.fn(),
      isPending: true,
      error: null,
      data: undefined,
    };

    const mockUseMutation = vi.fn().mockReturnValue(mockMutationResult);
    mockTsr.experiments.updateExperimentLocations.useMutation = mockUseMutation;

    const { result } = renderHook(() => useExperimentLocationsUpdate());

    expect(result.current.isPending).toBe(true);
  });

  it("should handle error state", () => {
    const mockError = new Error("Failed to update locations");
    const mockMutationResult = {
      mutate: vi.fn(),
      isPending: false,
      error: mockError,
      data: undefined,
    };

    const mockUseMutation = vi.fn().mockReturnValue(mockMutationResult);
    mockTsr.experiments.updateExperimentLocations.useMutation = mockUseMutation;

    const { result } = renderHook(() => useExperimentLocationsUpdate());

    expect(result.current.error).toBe(mockError);
  });

  it("should configure onSuccess callback", () => {
    const mockUseMutation = vi.fn().mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: null,
      data: undefined,
    });
    mockTsr.experiments.updateExperimentLocations.useMutation = mockUseMutation;

    renderHook(() => useExperimentLocationsUpdate());

    expect(mockUseMutation).toHaveBeenCalledWith({
      onSuccess: expect.any(Function),
    });
  });

  it("should invalidate queries on successful mutation", () => {
    const mockInvalidateQueries = vi.fn();
    const mockQueryClient = {
      invalidateQueries: mockInvalidateQueries,
    };
    mockTsr.useQueryClient.mockReturnValue(mockQueryClient as any);

    let onSuccessCallback: ((data: any, variables: any) => void) | undefined;

    const mockUseMutation = vi.fn().mockImplementation(({ onSuccess }) => {
      onSuccessCallback = onSuccess;
      return {
        mutate: vi.fn(),
        isPending: false,
        error: null,
        data: undefined,
      };
    });
    mockTsr.experiments.updateExperimentLocations.useMutation = mockUseMutation;

    renderHook(() => useExperimentLocationsUpdate());

    // Simulate successful mutation
    const mockData = { body: [] };
    const mockVariables = { params: { id: "test-experiment-id" } };

    if (onSuccessCallback) {
      onSuccessCallback(mockData, mockVariables);
    }

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["experiment-locations", "test-experiment-id"],
    });
  });
});
