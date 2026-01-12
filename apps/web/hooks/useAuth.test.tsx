import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

import { authClient } from "@repo/auth/client";
import type { Session } from "@repo/auth/types";

import {
  useSession,
  useSignInEmail,
  useVerifyEmail,
  useSignOut,
  useUser,
  useIsAuthenticated,
  useUpdateUser,
} from "./useAuth";

// Mock the auth client
vi.mock("@repo/auth/client", () => ({
  authClient: {
    getSession: vi.fn(),
    emailOtp: {
      sendVerificationOtp: vi.fn(),
    },
    signIn: {
      emailOtp: vi.fn(),
    },
    signOut: vi.fn(),
    updateUser: vi.fn(),
  },
}));

describe("useAuth hooks", () => {
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

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe("useSession", () => {
    it("should return session data when authenticated", async () => {
      const mockSession = { user: { id: "1", email: "test@example.com", name: "Test User" } };
      vi.mocked(authClient.getSession).mockResolvedValue({
        data: mockSession as Session,
        error: null,
      });

      const { result } = renderHook(() => useSession(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockSession);
      expect(authClient.getSession).toHaveBeenCalledTimes(1);
    });

    it("should return null for data when not authenticated (or error)", async () => {
      // getSession throws or returns null? Implementation catches error and returns null.
      vi.mocked(authClient.getSession).mockRejectedValue(new Error("Unauthorized"));

      const { result } = renderHook(() => useSession(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeNull();
    });
  });

  describe("useSignInEmail", () => {
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

  describe("useVerifyEmail", () => {
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

  describe("useSignOut", () => {
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

  describe("useUser", () => {
    it("should return user object from session", async () => {
      const mockSession = { user: { id: "1", name: "User" } };
      vi.mocked(authClient.getSession).mockResolvedValue({
        data: mockSession as Session,
        error: null,
      });

      const { result } = renderHook(() => useUser(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.user).toEqual(mockSession.user));
    });

    it("should return null user if no session", async () => {
      vi.mocked(authClient.getSession).mockResolvedValue({
        data: null,
        error: null,
      });

      const { result } = renderHook(() => useUser(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.user).toBeNull());
    });
  });

  describe("useIsAuthenticated", () => {
    it("should return true if session exists", async () => {
      const mockSession = { user: { id: "1" } };
      vi.mocked(authClient.getSession).mockResolvedValue({
        data: mockSession as Session,
        error: null,
      });

      const { result } = renderHook(() => useIsAuthenticated(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    });

    it("should return false if no session", async () => {
      vi.mocked(authClient.getSession).mockResolvedValue({
        data: null,
        error: null,
      });

      const { result } = renderHook(() => useIsAuthenticated(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isAuthenticated).toBe(false));
    });
  });

  describe("useUpdateUser", () => {
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
});
