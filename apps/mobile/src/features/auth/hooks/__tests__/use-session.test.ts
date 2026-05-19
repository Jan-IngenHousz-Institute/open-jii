// @vitest-environment jsdom
import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { useSession } from "../use-session";

const { mockGetItem, mockSetItem, mockUseSession, mockSignOut } = vi.hoisted(() => ({
  mockGetItem: vi.fn<(key: string) => string | null>(),
  mockSetItem: vi.fn(),
  mockUseSession: vi.fn(),
  mockSignOut: vi.fn(),
}));

vi.mock("expo-secure-store", () => ({
  getItem: mockGetItem,
  setItem: mockSetItem,
}));

vi.mock("~/features/auth/services/auth", () => ({
  useAuthClient: () => ({
    useSession: mockUseSession,
    signOut: mockSignOut,
  }),
}));

const SESSION_CACHE_KEY = "openjii_session_data";

const cachedPayload = {
  user: { id: "u1", name: "Cached User", email: "c@x.test", image: null },
  session: { expiresAt: "2099-01-01T00:00:00.000Z" },
};

const serverPayload = {
  user: { id: "u2", name: "Server User", email: "s@x.test", image: null },
  session: { expiresAt: "2099-06-01T00:00:00.000Z" },
};

describe("useSession", () => {
  beforeEach(() => {
    mockGetItem.mockReset();
    mockSetItem.mockReset();
    mockUseSession.mockReset();
    mockSignOut.mockReset();
  });

  it("is not loaded while BetterAuth pending and no cache", () => {
    mockGetItem.mockReturnValue(null);
    mockUseSession.mockReturnValue({ data: null, isPending: true, error: null });

    const { result } = renderHook(() => useSession());

    expect(result.current.isLoaded).toBe(false);
    expect(result.current.session).toBeUndefined();
  });

  it("is loaded with no session once BetterAuth resolves and cache is empty", () => {
    mockGetItem.mockReturnValue(null);
    mockUseSession.mockReturnValue({ data: null, isPending: false, error: null });

    const { result } = renderHook(() => useSession());

    expect(result.current.isLoaded).toBe(true);
    expect(result.current.session).toBeUndefined();
  });

  it("returns BetterAuth session when online", () => {
    mockGetItem.mockReturnValue(null);
    mockUseSession.mockReturnValue({ data: serverPayload, isPending: false, error: null });

    const { result } = renderHook(() => useSession());

    expect(result.current.isLoaded).toBe(true);
    expect(result.current.session?.data.user.id).toBe("u2");
  });

  it("falls back to cached session when BetterAuth returns null (offline)", async () => {
    mockGetItem.mockReturnValue(JSON.stringify(cachedPayload));
    mockUseSession.mockReturnValue({
      data: null,
      isPending: false,
      error: new Error("network"),
    });

    const { result } = renderHook(() => useSession());

    await waitFor(() => {
      expect(result.current.session?.data.user.id).toBe("u1");
    });
    expect(result.current.isLoaded).toBe(true);
  });

  it('treats empty-object cache "{}" as no cached session', () => {
    mockGetItem.mockReturnValue("{}");
    mockUseSession.mockReturnValue({ data: null, isPending: false, error: null });

    const { result } = renderHook(() => useSession());

    expect(result.current.session).toBeUndefined();
  });

  it("treats malformed cache JSON as no cached session", () => {
    mockGetItem.mockReturnValue("not-json");
    mockUseSession.mockReturnValue({ data: null, isPending: false, error: null });

    const { result } = renderHook(() => useSession());

    expect(result.current.session).toBeUndefined();
  });

  it("reports loaded immediately while pending if cache exists (splash hide path)", () => {
    mockGetItem.mockReturnValue(JSON.stringify(cachedPayload));
    mockUseSession.mockReturnValue({ data: null, isPending: true, error: null });

    const { result } = renderHook(() => useSession());

    expect(result.current.isLoaded).toBe(true);
    expect(result.current.session?.data.user.id).toBe("u1");
  });

  it("prefers BetterAuth session over cached session when both exist", () => {
    mockGetItem.mockReturnValue(JSON.stringify(cachedPayload));
    mockUseSession.mockReturnValue({ data: serverPayload, isPending: false, error: null });

    const { result } = renderHook(() => useSession());

    expect(result.current.session?.data.user.id).toBe("u2");
  });

  it("signOut clears cache and calls authClient.signOut", async () => {
    mockGetItem.mockReturnValue(JSON.stringify(cachedPayload));
    mockUseSession.mockReturnValue({ data: serverPayload, isPending: false, error: null });
    mockSignOut.mockResolvedValue(undefined);

    const { result } = renderHook(() => useSession());

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockSetItem).toHaveBeenCalledWith(SESSION_CACHE_KEY, "{}");
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it("signOut still clears cache when authClient.signOut throws (offline)", async () => {
    mockGetItem.mockReturnValue(JSON.stringify(cachedPayload));
    mockUseSession.mockReturnValue({ data: serverPayload, isPending: false, error: null });
    mockSignOut.mockRejectedValue(new Error("network"));

    const { result } = renderHook(() => useSession());

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockSetItem).toHaveBeenCalledWith(SESSION_CACHE_KEY, "{}");
  });

  it("rehydrates cached session when BetterAuth pending state flips with no server data", async () => {
    // Simulate cold start: no cache available initially, then cache materializes
    // (e.g. expo plugin wrote it) and BetterAuth finishes with no session.
    mockGetItem.mockReturnValueOnce(null).mockReturnValue(JSON.stringify(cachedPayload));
    mockUseSession.mockReturnValueOnce({ data: null, isPending: true, error: null });

    const { result, rerender } = renderHook(() => useSession());
    expect(result.current.session).toBeUndefined();

    mockUseSession.mockReturnValue({ data: null, isPending: false, error: null });
    rerender();

    await waitFor(() => {
      expect(result.current.session?.data.user.id).toBe("u1");
    });
  });
});
