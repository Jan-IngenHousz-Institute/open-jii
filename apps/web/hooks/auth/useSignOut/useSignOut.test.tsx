import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { authClient } from "@repo/auth/client";

import { useSignOut } from "./useSignOut";

// Mock the auth client
vi.mock("@repo/auth/client", () => ({
  authClient: {
    signOut: vi.fn(),
  },
}));

// Mock the revalidate server action
vi.mock("~/app/actions/revalidate", () => ({
  revalidateAuth: vi.fn(),
}));

describe("useSignOut", () => {
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

  it("should call signOut and clear session cache", async () => {
    vi.mocked(authClient.signOut).mockResolvedValue({
      data: { success: true },
      error: null,
    });

    const wrapper = createWrapper();
    // Pre-fill cache
    queryClient.setQueryData(["auth", "session"], { user: { id: "1" } });

    const { result } = renderHook(() => useSignOut(), { wrapper });

    await result.current.mutateAsync();

    expect(authClient.signOut).toHaveBeenCalled();

    const sessionData = queryClient.getQueryData(["auth", "session"]);
    expect(sessionData).toBeNull();
  });
});
