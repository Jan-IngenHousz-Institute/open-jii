/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-argument */
import { tsr } from "@/lib/tsr";
import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useUserInvitationCreate } from "./useUserInvitationCreate";

// Mock the tsr module
vi.mock("@/lib/tsr", () => ({
  tsr: {
    useQueryClient: vi.fn(),
    users: {
      createInvitations: {
        useMutation: vi.fn(),
      },
    },
  },
}));

const mockTsr = tsr as ReturnType<typeof vi.mocked<typeof tsr>>;

describe("useUserInvitationCreate", () => {
  const mockQueryClient = {
    invalidateQueries: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockTsr.useQueryClient.mockReturnValue(mockQueryClient as any);
  });

  it("should call useMutation with onSuccess callback", () => {
    const mockUseMutation = vi.fn().mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: null,
    });
    mockTsr.users.createInvitations.useMutation = mockUseMutation;

    renderHook(() => useUserInvitationCreate());

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
    mockTsr.users.createInvitations.useMutation = mockUseMutation;

    const { result } = renderHook(() => useUserInvitationCreate());

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
    mockTsr.users.createInvitations.useMutation = mockUseMutation;

    const { result } = renderHook(() => useUserInvitationCreate());

    expect(result.current.isPending).toBe(true);
  });

  it("should handle error state", () => {
    const mockError = new Error("Failed to create invitations");
    const mockMutationResult = {
      mutate: vi.fn(),
      isPending: false,
      error: mockError,
      data: undefined,
    };

    const mockUseMutation = vi.fn().mockReturnValue(mockMutationResult);
    mockTsr.users.createInvitations.useMutation = mockUseMutation;

    const { result } = renderHook(() => useUserInvitationCreate());

    expect(result.current.error).toBe(mockError);
  });

  it("should invalidate experiment-invitations queries on success", () => {
    let capturedOnSuccess: any;
    const mockUseMutation = vi.fn((opts: any) => {
      capturedOnSuccess = opts.onSuccess;
      return { mutate: vi.fn() };
    });

    mockTsr.users.createInvitations.useMutation = mockUseMutation as any;

    renderHook(() => useUserInvitationCreate());

    // Call onSuccess
    capturedOnSuccess();

    expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["experiment-invitations"],
    });
  });
});
