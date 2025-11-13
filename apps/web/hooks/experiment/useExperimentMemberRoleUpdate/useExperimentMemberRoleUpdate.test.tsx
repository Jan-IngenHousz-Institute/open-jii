/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-argument */
import { tsr } from "@/lib/tsr";
import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useExperimentMemberRoleUpdate } from "./useExperimentMemberRoleUpdate";

// Mock the tsr module
vi.mock("@/lib/tsr", () => ({
  tsr: {
    useQueryClient: vi.fn(),
    experiments: {
      updateExperimentMemberRole: {
        useMutation: vi.fn(),
      },
    },
  },
}));

const mockTsr = tsr as ReturnType<typeof vi.mocked<typeof tsr>>;

describe("useExperimentMemberRoleUpdate", () => {
  const mockQueryClient = {
    cancelQueries: vi.fn(),
    getQueryData: vi.fn(),
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockTsr.useQueryClient.mockReturnValue(mockQueryClient as any);
  });

  it("should call useMutation with correct callbacks", () => {
    const mockUseMutation = vi.fn().mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: null,
    });
    mockTsr.experiments.updateExperimentMemberRole.useMutation = mockUseMutation;

    renderHook(() => useExperimentMemberRoleUpdate());

    expect(mockUseMutation).toHaveBeenCalledWith({
      onMutate: expect.any(Function),
      onError: expect.any(Function),
      onSettled: expect.any(Function),
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
    mockTsr.experiments.updateExperimentMemberRole.useMutation = mockUseMutation;

    const { result } = renderHook(() => useExperimentMemberRoleUpdate());

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
    mockTsr.experiments.updateExperimentMemberRole.useMutation = mockUseMutation;

    const { result } = renderHook(() => useExperimentMemberRoleUpdate());

    expect(result.current.isPending).toBe(true);
  });

  it("should handle error state", () => {
    const mockError = new Error("Failed to update role");
    const mockMutationResult = {
      mutate: vi.fn(),
      isPending: false,
      error: mockError,
      data: undefined,
    };

    const mockUseMutation = vi.fn().mockReturnValue(mockMutationResult);
    mockTsr.experiments.updateExperimentMemberRole.useMutation = mockUseMutation;

    const { result } = renderHook(() => useExperimentMemberRoleUpdate());

    expect(result.current.error).toBe(mockError);
  });

  it("should optimistically update member role on mutate", async () => {
    const mockMembers = {
      body: [
        { user: { id: "user-1" }, role: "member" as const },
        { user: { id: "user-2" }, role: "member" as const },
      ],
    };

    mockQueryClient.getQueryData.mockReturnValue(mockMembers);

    let capturedOnMutate: any;
    const mockUseMutation = vi.fn((opts: any) => {
      capturedOnMutate = opts.onMutate;
      return { mutate: vi.fn() };
    });

    mockTsr.experiments.updateExperimentMemberRole.useMutation = mockUseMutation as any;

    renderHook(() => useExperimentMemberRoleUpdate());

    // Call onMutate
    await capturedOnMutate({
      params: { id: "exp-1", memberId: "user-1" },
      body: { role: "admin" },
    });

    expect(mockQueryClient.cancelQueries).toHaveBeenCalledWith({
      queryKey: ["experiment-members", "exp-1"],
    });
    expect(mockQueryClient.getQueryData).toHaveBeenCalledWith(["experiment-members", "exp-1"]);
    expect(mockQueryClient.setQueryData).toHaveBeenCalledWith(["experiment-members", "exp-1"], {
      body: [
        { user: { id: "user-1" }, role: "admin" },
        { user: { id: "user-2" }, role: "member" },
      ],
    });
  });

  it("should revert on error", async () => {
    const mockPreviousMembers = {
      body: [{ user: { id: "user-1" }, role: "member" as const }],
    };

    mockQueryClient.getQueryData.mockReturnValue(mockPreviousMembers);

    let capturedOnMutate: any;
    let capturedOnError: any;
    const mockUseMutation = vi.fn((opts: any) => {
      capturedOnMutate = opts.onMutate;
      capturedOnError = opts.onError;
      return { mutate: vi.fn() };
    });

    mockTsr.experiments.updateExperimentMemberRole.useMutation = mockUseMutation as any;

    renderHook(() => useExperimentMemberRoleUpdate());

    // Call onMutate first to get context
    const context = await capturedOnMutate({
      params: { id: "exp-1", memberId: "user-1" },
      body: { role: "admin" },
    });

    // Clear previous calls
    mockQueryClient.setQueryData.mockClear();

    // Call onError
    capturedOnError(new Error("Failed"), { params: { id: "exp-1" } }, context);

    expect(mockQueryClient.setQueryData).toHaveBeenCalledWith(
      ["experiment-members", "exp-1"],
      mockPreviousMembers,
    );
  });

  it("should invalidate queries on settled", async () => {
    let capturedOnSettled: any;
    const mockUseMutation = vi.fn((opts: any) => {
      capturedOnSettled = opts.onSettled;
      return { mutate: vi.fn() };
    });

    mockTsr.experiments.updateExperimentMemberRole.useMutation = mockUseMutation as any;

    renderHook(() => useExperimentMemberRoleUpdate());

    // Call onSettled
    await capturedOnSettled(null, null, { params: { id: "exp-1" } });

    expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["experiment-members", "exp-1"],
    });
  });

  it("should handle onMutate when previousMembers is undefined", async () => {
    mockQueryClient.getQueryData.mockReturnValue(undefined);

    let capturedOnMutate: any;
    const mockUseMutation = vi.fn((opts: any) => {
      capturedOnMutate = opts.onMutate;
      return { mutate: vi.fn() };
    });

    mockTsr.experiments.updateExperimentMemberRole.useMutation = mockUseMutation as any;

    renderHook(() => useExperimentMemberRoleUpdate());

    const context = await capturedOnMutate({
      params: { id: "exp-1", memberId: "user-1" },
      body: { role: "admin" },
    });

    expect(context).toEqual({ previousMembers: undefined });
    expect(mockQueryClient.setQueryData).not.toHaveBeenCalled();
  });

  it("should handle onError when context is undefined", () => {
    let capturedOnError: any;
    const mockUseMutation = vi.fn((opts: any) => {
      capturedOnError = opts.onError;
      return { mutate: vi.fn() };
    });

    mockTsr.experiments.updateExperimentMemberRole.useMutation = mockUseMutation as any;

    renderHook(() => useExperimentMemberRoleUpdate());

    // Call onError with undefined context
    capturedOnError(new Error("Failed"), { params: { id: "exp-1" } }, undefined);

    expect(mockQueryClient.setQueryData).not.toHaveBeenCalled();
  });
});
