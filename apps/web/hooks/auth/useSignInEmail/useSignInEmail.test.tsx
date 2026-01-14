import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { authClient } from "@repo/auth/client";

import { useSignInEmail } from "./useSignInEmail";

// Mock the auth client
vi.mock("@repo/auth/client", () => ({
  authClient: {
    emailOtp: {
      sendVerificationOtp: vi.fn(),
    },
  },
}));

describe("useSignInEmail", () => {
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

  it("should call sendVerificationOtp", async () => {
    vi.mocked(authClient.emailOtp.sendVerificationOtp).mockResolvedValue({
      data: { success: true },
      error: null,
    });

    const { result } = renderHook(() => useSignInEmail(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync("test@example.com");

    expect(authClient.emailOtp.sendVerificationOtp).toHaveBeenCalledWith({
      email: "test@example.com",
      type: "sign-in",
    });
  });
});
