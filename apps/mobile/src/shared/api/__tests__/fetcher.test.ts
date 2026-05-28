import type { ApiFetcherArgs } from "@ts-rest/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { customApiFetcher } from "../fetcher";

const { mockTsRestFetch, mockGetSession, mockSignOut, mockGetCookie } = vi.hoisted(() => ({
  mockTsRestFetch: vi.fn(),
  mockGetSession: vi.fn(),
  mockSignOut: vi.fn(),
  mockGetCookie: vi.fn(() => "sessionToken=cookie"),
}));

vi.mock("@ts-rest/core", () => ({
  tsRestFetchApi: (args: unknown) => mockTsRestFetch(args),
}));

vi.mock("~/features/auth/services/auth", () => ({
  getAuthClient: () => ({
    getSession: mockGetSession,
    signOut: mockSignOut,
    getCookie: mockGetCookie,
  }),
}));

vi.mock("~/shared/stores/environment-store", () => ({
  getEnvVar: (k: string) => (k === "BACKEND_URI" ? "https://api.test/" : ""),
}));

describe("customApiFetcher", () => {
  beforeEach(() => {
    mockTsRestFetch.mockReset();
    mockGetSession.mockReset();
    mockSignOut.mockReset();
    mockGetCookie.mockReset();
    mockGetCookie.mockReturnValue("sessionToken=cookie");
  });

  const args = {
    path: "/v1/x",
    method: "GET",
    body: undefined,
    headers: {},
    route: {} as never,
  } as unknown as ApiFetcherArgs;

  it("passes through a 200 response without touching auth", async () => {
    mockTsRestFetch.mockResolvedValueOnce({ status: 200, body: { ok: true } });

    const result = await customApiFetcher(args);

    expect(result.status).toBe(200);
    expect(mockGetSession).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("retries the request after a successful silent refresh on 401", async () => {
    mockTsRestFetch.mockResolvedValueOnce({ status: 401 }).mockResolvedValueOnce({ status: 200 });
    mockGetSession.mockResolvedValueOnce({ data: { session: { id: "s1" } } });

    const result = await customApiFetcher(args);

    expect(result.status).toBe(200);
    expect(mockGetSession).toHaveBeenCalledTimes(1);
    expect(mockTsRestFetch).toHaveBeenCalledTimes(2);
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("signs out when the refresh succeeds but the retry is still 401", async () => {
    mockTsRestFetch.mockResolvedValue({ status: 401 });
    mockGetSession.mockResolvedValueOnce({ data: { session: { id: "s1" } } });

    const result = await customApiFetcher(args);

    expect(result.status).toBe(401);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it("signs out when refresh itself fails (no session)", async () => {
    mockTsRestFetch.mockResolvedValueOnce({ status: 401 });
    mockGetSession.mockResolvedValueOnce({ data: null });

    const result = await customApiFetcher(args);

    expect(result.status).toBe(401);
    expect(mockGetSession).toHaveBeenCalledTimes(1);
    expect(mockTsRestFetch).toHaveBeenCalledTimes(1); // no retry when refresh fails
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it("signs out when refresh throws", async () => {
    mockTsRestFetch.mockResolvedValueOnce({ status: 401 });
    mockGetSession.mockRejectedValueOnce(new Error("offline"));

    const result = await customApiFetcher(args);

    expect(result.status).toBe(401);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it("dedupes concurrent refreshes (single-flight lock)", async () => {
    mockTsRestFetch.mockResolvedValue({ status: 401 });
    let resolveRefresh!: (v: { data: { session: { id: string } } }) => void;
    mockGetSession.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve;
        }),
    );

    const p1 = customApiFetcher(args);
    const p2 = customApiFetcher(args);
    const p3 = customApiFetcher(args);

    // Let the initial 401 reads settle, then resolve the shared refresh.
    await new Promise((r) => setTimeout(r, 0));
    resolveRefresh({ data: { session: { id: "s1" } } });

    await Promise.all([p1, p2, p3]);

    // One refresh call, no matter how many 401s came in concurrently.
    expect(mockGetSession).toHaveBeenCalledTimes(1);
  });

  it("attaches the Cookie header when a session cookie is present", async () => {
    mockTsRestFetch.mockResolvedValueOnce({ status: 200 });
    mockGetCookie.mockReturnValue("sessionToken=abc");

    await customApiFetcher(args);

    const sent = mockTsRestFetch.mock.calls[0][0];
    expect(sent.headers.Cookie).toBe("sessionToken=abc");
  });

  it("omits the Cookie header when getCookie returns empty", async () => {
    mockTsRestFetch.mockResolvedValueOnce({ status: 200 });
    mockGetCookie.mockReturnValue("");

    await customApiFetcher(args);

    const sent = mockTsRestFetch.mock.calls[0][0];
    expect(sent.headers.Cookie).toBeUndefined();
  });

  it("aborts the underlying fetch when the upstream signal aborts", async () => {
    const upstream = new AbortController();
    mockTsRestFetch.mockImplementation((sentArgs: { signal: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        sentArgs.signal.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      });
    });

    const p = customApiFetcher({ ...args, signal: upstream.signal } as ApiFetcherArgs);
    upstream.abort();

    await expect(p).rejects.toThrow();
  });

  it("aborts a hung fetch via its internal timeout", async () => {
    vi.useFakeTimers();
    try {
      mockTsRestFetch.mockImplementation((sentArgs: { signal: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          sentArgs.signal.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        });
      });

      const p = customApiFetcher(args);
      // Catch the rejection synchronously so the unhandled-rejection check passes
      // while we still advance the clock to trigger the timeout abort.
      const settled = p.catch((e: unknown) => e);
      await vi.advanceTimersByTimeAsync(10_000);
      const err = await settled;
      expect((err as Error)?.name).toBe("AbortError");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not abort a request that resolves within the timeout", async () => {
    vi.useFakeTimers();
    try {
      mockTsRestFetch.mockResolvedValueOnce({ status: 200 });

      const result = await customApiFetcher(args);

      expect(result.status).toBe(200);
      // The internal timeout would have fired had it not been cleared on success.
      await vi.advanceTimersByTimeAsync(15_000);
      expect(mockSignOut).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
