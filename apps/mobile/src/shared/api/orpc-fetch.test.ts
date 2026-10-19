import { beforeEach, describe, expect, it, vi } from "vitest";
import { configureAuthRefresh, orpcFetch } from "~/shared/api/orpc-fetch";

const mockFetch = vi.fn();
const mockRefreshSession = vi.fn();
const mockSignOut = vi.fn();
const mockHasCachedSession = vi.fn<() => boolean>();
const SESSION = "better-auth.dev.session_token=cookie";
const mockGetCookie = vi.fn<() => string | null | undefined>(() => SESSION);

vi.stubGlobal("fetch", mockFetch);

function makeRequest() {
  return new Request("https://api.test/v1/x", { method: "GET" });
}

describe("orpcFetch", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockRefreshSession.mockReset();
    mockSignOut.mockReset();
    mockGetCookie.mockReset();
    mockGetCookie.mockReturnValue(SESSION);
    mockHasCachedSession.mockReset();
    mockHasCachedSession.mockReturnValue(false);
    // Inject the auth seam the way shared/composition/auth-wiring does at boot.
    configureAuthRefresh({
      getCookie: mockGetCookie,
      hasCachedSession: mockHasCachedSession,
      refreshSession: mockRefreshSession,
      signOut: mockSignOut,
    });
  });

  it("passes through a 200 response without touching auth", async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

    const result = await orpcFetch(makeRequest(), undefined);

    expect(result.status).toBe(200);
    expect(mockRefreshSession).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("retries the request after a successful silent refresh on 401", async () => {
    mockFetch
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    mockRefreshSession.mockResolvedValueOnce(true);

    const result = await orpcFetch(makeRequest(), undefined);

    expect(result.status).toBe(200);
    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("sends the refreshed cookie when retrying an authenticated request", async () => {
    mockGetCookie.mockReturnValue("better-auth.dev.session_token=original");
    mockFetch
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    mockRefreshSession.mockImplementationOnce(() => {
      mockGetCookie.mockReturnValue("better-auth.dev.session_token=refreshed");
      return Promise.resolve(true);
    });

    await orpcFetch(makeRequest(), undefined);

    const originalHeaders: Headers = mockFetch.mock.calls[0][1].headers;
    const retryHeaders: Headers = mockFetch.mock.calls[1][1].headers;
    expect(originalHeaders.get("Cookie")).toBe("better-auth.dev.session_token=original");
    expect(retryHeaders.get("Cookie")).toBe("better-auth.dev.session_token=refreshed");
  });

  it("signs out when the refresh succeeds but the retry is still 401", async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 401 }));
    mockRefreshSession.mockResolvedValueOnce(true);

    const result = await orpcFetch(makeRequest(), undefined);

    expect(result.status).toBe(401);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it("signs out without retrying when the refresh fails", async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 401 }));
    mockRefreshSession.mockResolvedValueOnce(false);

    const result = await orpcFetch(makeRequest(), undefined);

    expect(result.status).toBe(401);
    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(1); // no retry when refresh fails
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, null, "", "better-auth.dev.oauth_state=pending"])(
    "does not refresh or sign out on 401 when the request had cookie %j",
    async (cookie) => {
      mockGetCookie.mockReturnValue(cookie);
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 401 }));

      const result = await orpcFetch(makeRequest(), undefined);

      expect(result.status).toBe(401);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockRefreshSession).not.toHaveBeenCalled();
      expect(mockSignOut).not.toHaveBeenCalled();
    },
  );

  it("signs out a cached session whose cookie has expired, without refreshing", async () => {
    mockGetCookie.mockReturnValue("");
    mockHasCachedSession.mockReturnValue(true);
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 401 }));

    const result = await orpcFetch(makeRequest(), undefined);

    expect(result.status).toBe(401);
    expect(mockRefreshSession).not.toHaveBeenCalled();
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it("does not sign out a new session when an earlier anonymous request returns 401", async () => {
    mockGetCookie.mockReturnValue("");
    mockHasCachedSession.mockReturnValue(true);
    mockFetch.mockImplementationOnce(() => {
      mockGetCookie.mockReturnValue("better-auth.dev.session_token=new-session");
      return Promise.resolve(new Response(null, { status: 401 }));
    });

    const result = await orpcFetch(makeRequest(), undefined);

    expect(result.status).toBe(401);
    expect(mockRefreshSession).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("attaches the Cookie header when a session cookie is present", async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));
    mockGetCookie.mockReturnValue("better-auth.dev.session_token=abc");

    await orpcFetch(makeRequest(), undefined);

    const sentInit = mockFetch.mock.calls[0][1] as { headers: Headers };
    expect(sentInit.headers.get("Cookie")).toBe("better-auth.dev.session_token=abc");
  });

  it("omits the Cookie header when getCookie returns empty", async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));
    mockGetCookie.mockReturnValue("");

    await orpcFetch(makeRequest(), undefined);

    const sentInit = mockFetch.mock.calls[0][1] as { headers: Headers };
    expect(sentInit.headers.get("Cookie")).toBeNull();
  });

  it("aborts the underlying fetch when the upstream signal aborts", async () => {
    const upstream = new AbortController();
    mockFetch.mockImplementation((_req: Request, init: { signal: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      });
    });

    const p = orpcFetch(makeRequest(), { signal: upstream.signal });
    upstream.abort();

    await expect(p).rejects.toThrow();
  });

  it("aborts a hung fetch via its internal timeout", async () => {
    vi.useFakeTimers();
    try {
      mockFetch.mockImplementation((_req: Request, init: { signal: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        });
      });

      const p = orpcFetch(makeRequest(), undefined);
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
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

      const result = await orpcFetch(makeRequest(), undefined);

      expect(result.status).toBe(200);
      await vi.advanceTimersByTimeAsync(15_000);
      expect(mockSignOut).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
