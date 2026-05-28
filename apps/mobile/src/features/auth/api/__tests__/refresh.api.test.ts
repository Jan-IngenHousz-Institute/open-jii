import { beforeEach, describe, expect, it, vi } from "vitest";

import { refreshSession } from "../refresh.api";

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

  it("returns false when getSession hangs past the timeout", async () => {
    vi.useFakeTimers();
    try {
      // eslint-disable-next-line @typescript-eslint/no-empty-function -- intentional: simulates a hang
      mockGetSession.mockImplementationOnce(() => new Promise(() => {}));

      const p = refreshSession();
      await vi.advanceTimersByTimeAsync(8_000);

      expect(await p).toBe(false);
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
