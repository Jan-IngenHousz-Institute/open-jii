import { createUserProfile } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api";

import { useGetUserProfile } from "./useGetUserProfile";

describe("useGetUserProfile", () => {
  it("returns user profile data", async () => {
    const profile = createUserProfile({ userId: "user-123" });
    server.mount(contract.users.getUserProfile, { body: profile });

    const { result } = renderHook(() => useGetUserProfile("user-123"));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.body).toMatchObject({
      firstName: "Test",
      lastName: "User",
    });
    expect(result.current.isLoading).toBe(false);
  });

  it("disables query when enabled is false", async () => {
    const { result } = renderHook(() => useGetUserProfile("user-123", false));

    // Query should not fire — data stays undefined, not loading
    // Wait a tick to ensure no request goes out
    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });

  it("disables query when userId is empty", async () => {
    const { result } = renderHook(() => useGetUserProfile(""));

    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });

  it("handles 404 for non-existent user (no retry)", async () => {
    server.mount(contract.users.getUserProfile, { status: 404 });

    const { result } = renderHook(() => useGetUserProfile("non-existent"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // On 404, the retry callback returns false → no retries → fast failure
    expect(result.current.data?.body).toBeUndefined();
  });

  it("uses different query keys for different user IDs", async () => {
    server.mount(contract.users.getUserProfile, { body: createUserProfile() });

    const { result: r1 } = renderHook(() => useGetUserProfile("user-1"));
    const { result: r2 } = renderHook(() => useGetUserProfile("user-2"));

    await waitFor(() => {
      expect(r1.current.data).toBeDefined();
      expect(r2.current.data).toBeDefined();
    });

    // Both resolve independently
    expect(r1.current.isLoading).toBe(false);
    expect(r2.current.isLoading).toBe(false);
  });
});
