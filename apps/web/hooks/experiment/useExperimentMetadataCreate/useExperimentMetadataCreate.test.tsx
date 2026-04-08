/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */
import { tsr } from "@/lib/tsr";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useExperimentMetadataCreate } from "./useExperimentMetadataCreate";

vi.mock("@/lib/tsr", () => ({
  tsr: {
    useQueryClient: vi.fn(),
    experiments: {
      createExperimentMetadata: {
        useMutation: vi.fn(),
      },
    },
  },
}));

const mockTsr = tsr as any;

describe("useExperimentMetadataCreate", () => {
  let queryClient: QueryClient;
  const mockCancelQueries = vi.fn().mockResolvedValue(undefined);
  const mockGetQueryData = vi.fn();
  const mockSetQueryData = vi.fn();
  const mockInvalidateQueries = vi.fn().mockResolvedValue(undefined);

  const createWrapper = () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();

    const mockQueryClient = {
      cancelQueries: mockCancelQueries,
      getQueryData: mockGetQueryData,
      setQueryData: mockSetQueryData,
      invalidateQueries: mockInvalidateQueries,
    };

    mockTsr.useQueryClient.mockReturnValue(mockQueryClient);
  });

  it("should call useMutation with correct configuration", () => {
    const mockUseMutation = vi.fn();
    mockTsr.experiments.createExperimentMetadata.useMutation = mockUseMutation;

    renderHook(() => useExperimentMetadataCreate(), {
      wrapper: createWrapper(),
    });

    expect(mockUseMutation).toHaveBeenCalledWith({
      onMutate: expect.any(Function),
      onError: expect.any(Function),
      onSettled: expect.any(Function),
    });
  });

  describe("onMutate callback", () => {
    it("should cancel queries and return previous data", async () => {
      const mockPreviousData = {
        body: [{ metadataId: "meta-1", metadata: { key: "value" } }],
      };
      mockGetQueryData.mockReturnValue(mockPreviousData);

      let onMutate: any;

      mockTsr.experiments.createExperimentMetadata.useMutation = vi.fn((opts: any) => {
        onMutate = opts.onMutate;
        return {};
      });

      renderHook(() => useExperimentMetadataCreate(), {
        wrapper: createWrapper(),
      });

      const variables = { params: { id: "exp-123" }, body: { metadata: { key: "new" } } };
      const result = await onMutate(variables);

      expect(mockCancelQueries).toHaveBeenCalledWith({
        queryKey: ["experiment", "exp-123", "metadata"],
      });
      expect(mockGetQueryData).toHaveBeenCalledWith(["experiment", "exp-123", "metadata"]);
      expect(result).toEqual({ previousData: mockPreviousData });
    });
  });

  describe("onError callback", () => {
    it("should revert to previous data when context has previousData", () => {
      let onError: any;

      mockTsr.experiments.createExperimentMetadata.useMutation = vi.fn((opts: any) => {
        onError = opts.onError;
        return {};
      });

      renderHook(() => useExperimentMetadataCreate(), {
        wrapper: createWrapper(),
      });

      const error = new Error("Creation failed");
      const variables = { params: { id: "exp-123" }, body: { metadata: { key: "new" } } };
      const context = {
        previousData: { body: [{ metadataId: "meta-1" }] },
      };

      onError(error, variables, context);

      expect(mockSetQueryData).toHaveBeenCalledWith(
        ["experiment", "exp-123", "metadata"],
        context.previousData,
      );
    });

    it("should not revert data when context has no previousData", () => {
      let onError: any;

      mockTsr.experiments.createExperimentMetadata.useMutation = vi.fn((opts: any) => {
        onError = opts.onError;
        return {};
      });

      renderHook(() => useExperimentMetadataCreate(), {
        wrapper: createWrapper(),
      });

      const error = new Error("Creation failed");
      const variables = { params: { id: "exp-123" }, body: { metadata: { key: "new" } } };

      onError(error, variables, {});

      expect(mockSetQueryData).not.toHaveBeenCalled();
    });

    it("should not revert data when context is undefined", () => {
      let onError: any;

      mockTsr.experiments.createExperimentMetadata.useMutation = vi.fn((opts: any) => {
        onError = opts.onError;
        return {};
      });

      renderHook(() => useExperimentMetadataCreate(), {
        wrapper: createWrapper(),
      });

      const error = new Error("Creation failed");
      const variables = { params: { id: "exp-123" }, body: { metadata: { key: "new" } } };

      onError(error, variables, undefined);

      expect(mockSetQueryData).not.toHaveBeenCalled();
    });
  });

  describe("onSettled callback", () => {
    it("should invalidate queries after mutation", async () => {
      let onSettled: any;

      mockTsr.experiments.createExperimentMetadata.useMutation = vi.fn((opts: any) => {
        onSettled = opts.onSettled;
        return {};
      });

      renderHook(() => useExperimentMetadataCreate(), {
        wrapper: createWrapper(),
      });

      const variables = { params: { id: "exp-123" }, body: { metadata: { key: "new" } } };
      await onSettled(undefined, undefined, variables);

      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["experiment", "exp-123", "metadata"],
      });
    });
  });
});
