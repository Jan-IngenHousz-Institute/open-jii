import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { authClient } from "@repo/auth/client";
import type { Session } from "@repo/auth/types";

import { useVerifyEmail } from "./useVerifyEmail";

// Mock the auth client
vi.mock("@repo/auth/client", () => ({
  authClient: {
    signIn: {
      emailOtp: vi.fn(),
    },
  },
}));

// Mock the revalidate server action
vi.mock("~/app/actions/revalidate", () => ({
  revalidateAuth: vi.fn(),
}));

describe("useVerifyEmail", () => {
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

  it("should call signIn.emailOtp and update session cache on success", async () => {
    const mockSession = { user: { id: "1", email: "test@example.com" } };
    vi.mocked(authClient.signIn.emailOtp).mockResolvedValue({
      data: mockSession as Session,
      error: null,
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useVerifyEmail(), { wrapper });

    await result.current.mutateAsync({ email: "test@example.com", code: "123456" });

    expect(authClient.signIn.emailOtp).toHaveBeenCalledWith({
      email: "test@example.com",
      otp: "123456",
    });

    // Verify cache update
    const sessionData = queryClient.getQueryData(["auth", "session"]);
    expect(sessionData).toEqual(mockSession);
  });
});
