import { tsr } from "@/lib/tsr";
import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useUserInvitations } from "./useUserInvitations";

// Mock the tsr module
vi.mock("@/lib/tsr", () => ({
  tsr: {
    users: {
      listInvitations: {
        useQuery: vi.fn(),
      },
    },
  },
}));

const mockTsr = tsr as ReturnType<typeof vi.mocked<typeof tsr>>;

describe("useUserInvitations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call useQuery with correct queryData and queryKey", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: [] },
      isLoading: false,
      error: null,
    });
    mockTsr.users.listInvitations.useQuery = mockUseQuery;

    renderHook(() => useUserInvitations("experiment", "exp-123"));

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: {
        query: {
          resourceType: "experiment",
          resourceId: "exp-123",
        },
      },
      queryKey: ["experiment-invitations", "experiment", "exp-123"],
    });
  });

  it("should return query result with data", () => {
    const mockInvitations = [
      { id: "inv-1", email: "user1@example.com", role: "member", status: "pending" },
      { id: "inv-2", email: "user2@example.com", role: "admin", status: "pending" },
    ];

    const mockQueryResult = {
      data: { body: mockInvitations },
      isLoading: false,
      error: null,
    };

    const mockUseQuery = vi.fn().mockReturnValue(mockQueryResult);
    mockTsr.users.listInvitations.useQuery = mockUseQuery;

    const { result } = renderHook(() => useUserInvitations("experiment", "exp-123"));

    expect(result.current).toBe(mockQueryResult);
  });

  it("should handle loading state", () => {
    const mockQueryResult = {
      data: undefined,
      isLoading: true,
      error: null,
    };

    const mockUseQuery = vi.fn().mockReturnValue(mockQueryResult);
    mockTsr.users.listInvitations.useQuery = mockUseQuery;

    const { result } = renderHook(() => useUserInvitations("experiment", "exp-456"));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it("should handle error state", () => {
    const mockError = new Error("Failed to fetch invitations");
    const mockQueryResult = {
      data: undefined,
      isLoading: false,
      error: mockError,
    };

    const mockUseQuery = vi.fn().mockReturnValue(mockQueryResult);
    mockTsr.users.listInvitations.useQuery = mockUseQuery;

    const { result } = renderHook(() => useUserInvitations("experiment", "exp-789"));

    expect(result.current.error).toBe(mockError);
  });
});
