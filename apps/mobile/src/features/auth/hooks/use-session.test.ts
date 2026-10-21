// @vitest-environment jsdom
import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useSession } from "~/features/auth/hooks/use-session";

const { mockGetItem, mockSetItem, mockUseSession, mockSignOut } = vi.hoisted(() => ({
  mockGetItem: vi.fn<(key: string) => string | null>(),
  mockSetItem: vi.fn(),
  mockUseSession: vi.fn(),
  mockSignOut: vi.fn(),
}));

vi.mock("react-native", () => ({
  AppState: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
}));

vi.mock("expo-secure-store", () => ({
  getItem: mockGetItem,
  setItem: mockSetItem,
}));

vi.mock("~/features/auth/services/auth", () => ({
  useAuthClient: () => ({
    useSession: mockUseSession,
    signOut: mockSignOut,
    $store: { atoms: { session: { get: () => ({}), set: vi.fn() } } },
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

describe("guest restoration and departure", () => {
  const guest = {
    user: {
      id: "fresh-guest",
      name: "Visitor",
      isAnonymous: true,
      createdAt: "2026-10-20T12:00:00Z",
    },
    session: { expiresAt: "2027-01-01" },
  };
  let storage: Map<string, string>;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-21T12:00:00Z"));
    storage = new Map([[SESSION_CACHE_KEY, JSON.stringify(guest)]]);
    mockGetItem.mockImplementation((key) => storage.get(key) ?? null);
    mockSetItem.mockImplementation((key, value) => {
      storage.set(key, value);
    });
    mockUseSession.mockReturnValue({ data: null, isPending: false, error: new Error("offline") });
  });
  afterEach(() => vi.useRealTimers());
  it("keeps an offline guest but never restores it after an authoritative no-session response", () => {
    const { result, rerender } = renderHook(() => useSession());
    expect(result.current.user?.id).toBe("fresh-guest");
    mockUseSession.mockReturnValue({ data: null, isPending: false, error: null });
    rerender();
    expect(result.current.user).toBeUndefined();
    expect(storage.get("openjii_cookie")).toBe("{}");
    mockUseSession.mockReturnValue({ data: null, isPending: false, error: new Error("offline") });
    rerender();
    expect(result.current.user).toBeUndefined();
  });
  it("expires while left open and removes credentials with an explanation for login", () => {
    storage.delete("openjii_left_fresh-guest");
    const validGuest = { ...guest, user: { ...guest.user, id: "deadline-guest" } };
    storage.set(SESSION_CACHE_KEY, JSON.stringify(validGuest));
    vi.setSystemTime(new Date("2026-10-27T11:59:59Z"));
    const { result } = renderHook(() => useSession());
    expect(result.current.user?.id).toBe("deadline-guest");
    act(() => vi.advanceTimersByTime(30_000));
    expect(result.current.user).toBeUndefined();
    expect(storage.get("openjii_cookie")).toBe("{}");
    expect(storage.get("openjii_guest_expired")).toBe("true");
  });
  it("finishes local departure even if the transport ignores the abort signal", async () => {
    storage.set(
      SESSION_CACHE_KEY,
      JSON.stringify({ ...guest, user: { ...guest.user, id: "timeout-guest" } }),
    );
    mockSignOut.mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(() => useSession());
    let departure: Promise<void>;
    act(() => {
      departure = result.current.signOut();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
      await departure;
    });
    expect(storage.get("openjii_cookie")).toBe("{}");
    expect(result.current.user).toBeUndefined();
  });
});
