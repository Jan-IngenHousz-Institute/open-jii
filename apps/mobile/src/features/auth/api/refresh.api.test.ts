import { beforeEach, describe, expect, it, vi } from "vitest";
import { refreshSession } from "~/features/auth/api/refresh.api";
import { deferred } from "~/shared/testing/deferred";

const { mockGetSession, mockGetCookie } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockGetCookie: vi.fn<() => string>(),
}));

vi.mock("~/features/auth/services/auth", () => ({
  getAuthClient: () => ({ getSession: mockGetSession, getCookie: mockGetCookie }),
}));

describe("refreshSession", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockGetCookie.mockReset();
    mockGetCookie.mockReturnValue("better-auth.dev.session_token=token-a");
  });

  it("returns true when getSession resolves with a valid session", async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: { id: "s1" } } });

    expect(await refreshSession()).toBe(true);
  });

  it("returns false when getSession resolves without a session", async () => {
    mockGetSession.mockResolvedValueOnce({ data: null });

    expect(await refreshSession()).toBe(false);
  });

  it("returns false when getSession rejects (e.g. offline)", async () => {
    mockGetSession.mockRejectedValueOnce(new Error("offline"));

    expect(await refreshSession()).toBe(false);
  });

  it("forwards fetchOptions.signal so the upstream call can be cancelled", async () => {
    mockGetSession.mockImplementationOnce(({ fetchOptions }) => {
      return new Promise((_resolve, reject) => {
        fetchOptions.signal.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      });
    });

    vi.useFakeTimers();
    try {
      const p = refreshSession();
      await vi.advanceTimersByTimeAsync(8_000);
      expect(await p).toBe(false);

      // The mock saw a signal and that signal was aborted by the timeout.
      const call = mockGetSession.mock.calls[0][0];
      expect(call.fetchOptions.signal).toBeInstanceOf(AbortSignal);
      expect(call.fetchOptions.signal.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("starts a fresh refresh after a timeout even if the old upstream ignores the abort", async () => {
    // Neither upstream reacts to the abort signal, as a stuck request would not.
    const stuck = deferred<{ data: { session: { id: string } } }>();
    const fresh = deferred<{ data: { session: { id: string } } }>();
    mockGetSession.mockReturnValueOnce(stuck.promise).mockReturnValueOnce(fresh.promise);

    vi.useFakeTimers();
    try {
      const first = refreshSession();
      await vi.advanceTimersByTimeAsync(8_000);
      expect(await first).toBe(false);

      const second = refreshSession();
      expect(mockGetSession).toHaveBeenCalledTimes(2);

      // A late settle of the old upstream must not evict the new refresh.
      stuck.resolve({ data: { session: { id: "s1" } } });
      await vi.advanceTimersByTimeAsync(0);
      const third = refreshSession();
      expect(mockGetSession).toHaveBeenCalledTimes(2);

      fresh.resolve({ data: { session: { id: "s2" } } });
      expect(await second).toBe(true);
      expect(await third).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("dedupes concurrent callers via the single-flight lock", async () => {
    const session = deferred<{ data: { session: { id: string } } }>();
    mockGetSession.mockReturnValueOnce(session.promise);

    const p1 = refreshSession();
    const p2 = refreshSession();
    session.resolve({ data: { session: { id: "s1" } } });

    expect(await p1).toBe(true);
    expect(await p2).toBe(true);
    expect(mockGetSession).toHaveBeenCalledTimes(1);
  });

  it("starts a separate refresh for a session token that changed mid-flight", async () => {
    const first = deferred<{ data: null }>();
    mockGetSession.mockReturnValueOnce(first.promise);
    const forTokenA = refreshSession();

    mockGetCookie.mockReturnValue("better-auth.dev.session_token=token-b");
    mockGetSession.mockResolvedValueOnce({ data: { session: { id: "s-b" } } });
    expect(await refreshSession()).toBe(true);
    expect(mockGetSession).toHaveBeenCalledTimes(2);

    first.resolve({ data: null });
    expect(await forTokenA).toBe(false);
  });
});
