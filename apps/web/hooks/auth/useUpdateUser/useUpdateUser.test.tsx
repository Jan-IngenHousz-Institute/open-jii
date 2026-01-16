import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { authClient } from "@repo/auth/client";

import { useUpdateUser } from "./useUpdateUser";

// Mock the auth client
vi.mock("@repo/auth/client", () => ({
  authClient: {
    updateUser: vi.fn(),
  },
}));

describe("useUpdateUser", () => {
  let queryClient: QueryClient;

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
  });

  it("should call updateUser and invalidate queries on success", async () => {
    vi.mocked(authClient.updateUser).mockResolvedValue({
      data: { success: true },
      error: null,
    });

    const wrapper = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateUser(), { wrapper });

    await result.current.mutateAsync({ name: "New Name" });

    expect(authClient.updateUser).toHaveBeenCalledWith({ name: "New Name" });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["auth"] });
  });
});
