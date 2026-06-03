import { beforeEach, describe, expect, it, vi } from "vitest";
import { refreshSession } from "~/features/auth/api/refresh.api";

const { mockGetSession } = vi.hoisted(() => ({ mockGetSession: vi.fn() }));

vi.mock("~/features/auth/services/auth", () => ({
  getAuthClient: () => ({ getSession: mockGetSession }),
}));

describe("refreshSession", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
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

  it("keeps the single-flight lock until the upstream settles, not just the race", async () => {
    // Regression: previously, Promise.race resolved the caller and cleared
    // refreshInFlight in `finally`, while the underlying getSession kept
    // running. Subsequent 401s would then kick off a second concurrent
    // refresh. The lock must stay held until the upstream actually settles.
    let resolveSession!: (v: { data: { session: { id: string } } }) => void;
    // Ignore the abort signal so the upstream stays in flight past the timeout.
    mockGetSession.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSession = resolve;
        }),
    );

    vi.useFakeTimers();
    try {
      const first = refreshSession();
      await vi.advanceTimersByTimeAsync(8_000);
      expect(await first).toBe(false);

      // Upstream still in flight. A second caller must dedupe onto it
      // rather than starting a fresh getSession.
      const second = refreshSession();
      expect(mockGetSession).toHaveBeenCalledTimes(1);

      // Resolve the upstream — the second caller now sees the real result.
      resolveSession({ data: { session: { id: "s1" } } });
      await vi.advanceTimersByTimeAsync(0);
      expect(await second).toBe(true);

      // After the upstream settles, the lock releases and the next call
      // starts fresh.
      mockGetSession.mockResolvedValueOnce({ data: { session: { id: "s2" } } });
      expect(await refreshSession()).toBe(true);
      expect(mockGetSession).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("dedupes concurrent callers via the single-flight lock", async () => {
    let resolveSession!: (v: { data: { session: { id: string } } }) => void;
    mockGetSession.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSession = resolve;
        }),
    );

    const p1 = refreshSession();
    const p2 = refreshSession();
    resolveSession({ data: { session: { id: "s1" } } });

    expect(await p1).toBe(true);
    expect(await p2).toBe(true);
    expect(mockGetSession).toHaveBeenCalledTimes(1);
  });
});
