import { beforeEach, describe, expect, it, vi } from "vitest";
import { orpcFetch } from "~/shared/api/orpc-fetch";
import { deferred } from "~/shared/testing/deferred";

const TOKEN_A = "better-auth.dev.session_token=token-a";
const TOKEN_B = "better-auth.dev.session_token=token-b";

const auth = vi.hoisted(() => ({
  cookie: "",
  getSessionCookies: [] as string[],
  signOutCookies: [] as string[],
  getSession: vi.fn(),
}));

vi.mock("~/features/auth/services/auth", () => ({
  getAuthClient: () => ({
    getCookie: () => auth.cookie,
    getSession: (...args: unknown[]) => {
      auth.getSessionCookies.push(auth.cookie);
      return auth.getSession(...args);
    },
    signOut: () => {
      auth.signOutCookies.push(auth.cookie);
      return Promise.resolve();
    },
  }),
}));
vi.mock("~/features/auth/services/session-cache", () => ({ getCachedSession: () => null }));

const mockFetch = vi.fn<(request: Request, init: { headers: Headers }) => Promise<Response>>();
vi.stubGlobal("fetch", mockFetch);

await import("~/shared/composition/auth-wiring");

const request = () => new Request("https://api.test/v1/experiments", { method: "GET" });

beforeEach(() => {
  auth.cookie = TOKEN_A;
  auth.getSessionCookies = [];
  auth.signOutCookies = [];
  auth.getSession.mockReset();
  mockFetch.mockReset();
});

describe("401 handling across a change of session", () => {
  it("does not sign out a new session because an older session's refresh failed", async () => {
    const refreshForA = deferred<{ data: null }>();
    auth.getSession
      .mockReturnValueOnce(refreshForA.promise)
      .mockResolvedValueOnce({ data: { session: { id: "session-b" } } });
    mockFetch.mockImplementation((_request, init) =>
      Promise.resolve(
        new Response(null, { status: init.headers.get("Cookie") === TOKEN_B ? 200 : 401 }),
      ),
    );
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 401 }));
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 401 }));

    const fromA = orpcFetch(request(), undefined);
    await vi.waitFor(() => expect(auth.getSessionCookies).toEqual([TOKEN_A]));

    auth.cookie = TOKEN_B;
    const fromB = await orpcFetch(request(), undefined);
    refreshForA.resolve({ data: null });

    expect((await fromA).status).toBe(401);
    expect(fromB.status).toBe(200);
    expect(auth.getSessionCookies).toEqual([TOKEN_A, TOKEN_B]);
    expect(auth.signOutCookies).toEqual([]);
  });

  it("still signs out a session whose own refresh fails", async () => {
    auth.getSession.mockResolvedValueOnce({ data: null });
    mockFetch.mockResolvedValue(new Response(null, { status: 401 }));

    expect((await orpcFetch(request(), undefined)).status).toBe(401);
    expect(auth.signOutCookies).toEqual([TOKEN_A]);
  });
});
