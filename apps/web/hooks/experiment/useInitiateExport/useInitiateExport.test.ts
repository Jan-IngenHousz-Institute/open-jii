/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
import { tsr } from "@/lib/tsr";
import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useInitiateExport } from "./useInitiateExport";

// Mock the tsr module
vi.mock("@/lib/tsr", () => ({
  tsr: {
    useQueryClient: vi.fn(),
    experiments: {
      initiateExport: {
        useMutation: vi.fn(),
      },
    },
  },
}));

const mockTsr = tsr as ReturnType<typeof vi.mocked<typeof tsr>>;

describe("useInitiateExport", () => {
  const mockInvalidateQueries = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();

    const mockQueryClient = {
      invalidateQueries: mockInvalidateQueries,
    };

    mockTsr.useQueryClient.mockReturnValue(mockQueryClient as any);
  });

  it("should call useMutation with correct configuration", () => {
    const mockUseMutation = vi.fn();
    mockTsr.experiments.initiateExport.useMutation = mockUseMutation as any;

    renderHook(() => useInitiateExport());

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

    mockTsr.experiments.initiateExport.useMutation = vi
      .fn()
      .mockReturnValue(mockMutationResult) as any;

    const { result } = renderHook(() => useInitiateExport());

    expect(result.current).toBe(mockMutationResult);
  });

  it("should accept onSuccess callback", () => {
    const mockUseMutation = vi.fn();
    mockTsr.experiments.initiateExport.useMutation = mockUseMutation as any;

    const mockOnSuccess = vi.fn();

    renderHook(() => useInitiateExport({ onSuccess: mockOnSuccess }));

    expect(mockUseMutation).toHaveBeenCalledWith({
      onSuccess: expect.any(Function),
    });
  });

  describe("onSuccess callback", () => {
    it("should invalidate exports queries with correct queryKey", async () => {
      let onSuccess: ((data: any, variables: any) => Promise<void>) | undefined;

      mockTsr.experiments.initiateExport.useMutation = vi.fn((opts: any) => {
        onSuccess = opts.onSuccess;
        return { mutate: vi.fn() };
      }) as any;

      renderHook(() => useInitiateExport());

      const variables = {
        params: { id: "exp-123" },
        body: { tableName: "raw_data", format: "csv" },
      };

      const data = { body: { exportId: "export-456" } };

      await onSuccess?.(data, variables);

      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["exports", "exp-123", "raw_data"],
      });
    });

    it("should call custom onSuccess callback after invalidating queries", async () => {
      const mockCustomOnSuccess = vi.fn();
      let onSuccess: ((data: any, variables: any) => Promise<void>) | undefined;

      mockTsr.experiments.initiateExport.useMutation = vi.fn((opts: any) => {
        onSuccess = opts.onSuccess;
        return { mutate: vi.fn() };
      }) as any;

      renderHook(() => useInitiateExport({ onSuccess: mockCustomOnSuccess }));

      const variables = {
        params: { id: "exp-123" },
        body: { tableName: "raw_data", format: "csv" },
      };

      const data = { body: { exportId: "export-456" } };

      await onSuccess?.(data, variables);

      expect(mockInvalidateQueries).toHaveBeenCalled();
      expect(mockCustomOnSuccess).toHaveBeenCalled();
    });

    it("should invalidate queries for different table names", async () => {
      let onSuccess: ((data: any, variables: any) => Promise<void>) | undefined;

      mockTsr.experiments.initiateExport.useMutation = vi.fn((opts: any) => {
        onSuccess = opts.onSuccess;
        return { mutate: vi.fn() };
      }) as any;

      renderHook(() => useInitiateExport());

      const variables = {
        params: { id: "exp-123" },
        body: { tableName: "device", format: "json" },
      };

      const data = { body: { exportId: "export-789" } };

      await onSuccess?.(data, variables);

      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["exports", "exp-123", "device"],
      });
    });

    it("should not call custom onSuccess if not provided", async () => {
      let onSuccess: ((data: any, variables: any) => Promise<void>) | undefined;

      mockTsr.experiments.initiateExport.useMutation = vi.fn((opts: any) => {
        onSuccess = opts.onSuccess;
        return { mutate: vi.fn() };
      }) as any;

      renderHook(() => useInitiateExport());

      const variables = {
        params: { id: "exp-123" },
        body: { tableName: "raw_data", format: "parquet" },
      };

      const data = { body: { exportId: "export-999" } };

      // Should not throw error when onSuccess is undefined
      await expect(onSuccess?.(data, variables)).resolves.toBeUndefined();
      expect(mockInvalidateQueries).toHaveBeenCalled();
    });
  });
});
