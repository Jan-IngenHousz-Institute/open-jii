import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLoginFlow } from "./use-login";

const {
  social,
  emailOtp,
  getCookie,
  getSession,
  prefetchOfflineData,
  ensureDeviceRegistered,
  toastError,
} = vi.hoisted(() => ({
  social: vi.fn(),
  emailOtp: vi.fn(),
  getCookie: vi.fn(),
  getSession: vi.fn(),
  prefetchOfflineData: vi.fn(),
  ensureDeviceRegistered: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("~/features/auth/services/auth", () => ({
  getAuthClient: () => ({
    signIn: { social, emailOtp },
    getCookie,
    getSession,
  }),
}));
vi.mock("~/shared/composition/prefetch-offline-data", () => ({ prefetchOfflineData }));
vi.mock("~/shared/composition/ensure-device-registered", () => ({ ensureDeviceRegistered }));
vi.mock("sonner-native", () => ({ toast: { error: toastError } }));
vi.mock("~/shared/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("~/shared/observability/logger", () => ({
  createLogger: () => ({ error: vi.fn() }),
}));

let queryClient: QueryClient;

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  vi.resetAllMocks();
  queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  // Expo discards browser cancellation and returns the original redirect response.
  social.mockResolvedValue({ data: { redirect: true, url: "https://provider.test" }, error: null });
  getCookie.mockResolvedValue("");
  getSession.mockResolvedValue({ data: null });
});

afterEach(() => {
  cleanup();
  queryClient.clear();
});

describe.each(["GitHub", "ORCID"] as const)("%s sign-in", (provider) => {
  function start(flow: ReturnType<typeof useLoginFlow>) {
    return provider === "GitHub" ? flow.startGitHubLogin() : flow.startOrcidLogin();
  }

  it.each(["", "better-auth.dev.oauth_state=pending"])(
    "reports an unfinished sign-in after cancel with cookie %j and makes no follow-up requests",
    async (cookie) => {
      getCookie.mockResolvedValue(cookie);
      const { result } = renderHook(() => useLoginFlow(), { wrapper });

      let completed: boolean | undefined;
      await act(async () => {
        completed = await start(result.current);
      });

      expect(completed).toBe(false);
      expect(getSession).not.toHaveBeenCalled();
      expect(prefetchOfflineData).not.toHaveBeenCalled();
      expect(ensureDeviceRegistered).not.toHaveBeenCalled();
      expect(toastError).not.toHaveBeenCalled();
      expect(result.current.githubLoading).toBe(false);
      expect(result.current.orcidLoading).toBe(false);
    },
  );

  it.each([
    "better-auth.dev.session_token=valid",
    "__Secure-better-auth.prod.session_token=valid; better-auth.prod.oauth_state=pending",
  ])("prefetches and registers once after sign-in with cookie %j", async (cookie) => {
    getCookie.mockResolvedValue(cookie);
    getSession.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const { result } = renderHook(() => useLoginFlow(), { wrapper });

    await act(async () => {
      await start(result.current);
    });

    expect(getSession).toHaveBeenCalledTimes(1);
    expect(prefetchOfflineData).toHaveBeenCalledExactlyOnceWith(queryClient, "user-1");
    expect(ensureDeviceRegistered).toHaveBeenCalledTimes(1);
    expect(toastError).not.toHaveBeenCalled();
  });

  async function signIn() {
    const { result } = renderHook(() => useLoginFlow(), { wrapper });
    let completed: boolean | undefined;
    await act(async () => {
      completed = await start(result.current);
    });
    return completed;
  }

  it("reports a finished sign-in once the browser stores a new session token", async () => {
    social.mockImplementation(() => {
      getCookie.mockResolvedValue("better-auth.dev.session_token=valid");
      return Promise.resolve({
        data: { redirect: true, url: "https://provider.test" },
        error: null,
      });
    });
    getSession.mockResolvedValue({ data: { user: { id: "user-1" } } });

    expect(await signIn()).toBe(true);
    expect(prefetchOfflineData).toHaveBeenCalledExactlyOnceWith(queryClient, "user-1");
  });

  it("reports an unfinished sign-in when a cancel leaves an old session token in place", async () => {
    getCookie.mockResolvedValue("better-auth.dev.session_token=revoked");
    getSession.mockResolvedValue({ data: null, error: null });

    expect(await signIn()).toBe(false);
  });

  it("skips prefetch and registration when the server reports no session for the token", async () => {
    getCookie.mockResolvedValue("better-auth.dev.session_token=revoked");
    getSession.mockResolvedValue({ data: null, error: null });

    await signIn();

    expect(prefetchOfflineData).not.toHaveBeenCalled();
    expect(ensureDeviceRegistered).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("skips both after a cancel that left a revoked token beside the OAuth state", async () => {
    getCookie.mockResolvedValue(
      "better-auth.dev.session_token=revoked; better-auth.dev.oauth_state=pending",
    );
    getSession.mockImplementation(() => {
      getCookie.mockResolvedValue("better-auth.dev.oauth_state=pending");
      return Promise.resolve({ data: null, error: null });
    });

    await signIn();

    expect(prefetchOfflineData).not.toHaveBeenCalled();
    expect(ensureDeviceRegistered).not.toHaveBeenCalled();
  });

  it.each([
    ["rejects", () => getSession.mockRejectedValue(new Error("offline"))],
    [
      "returns an error",
      () => getSession.mockResolvedValue({ data: null, error: { status: 503 } }),
    ],
  ])(
    "still prefetches and registers with no user id when the session lookup %s",
    async (_outcome, arrange) => {
      getCookie.mockResolvedValue("better-auth.dev.session_token=valid");
      arrange();

      await signIn();

      expect(prefetchOfflineData).toHaveBeenCalledExactlyOnceWith(queryClient, undefined);
      expect(ensureDeviceRegistered).toHaveBeenCalledTimes(1);
      expect(toastError).not.toHaveBeenCalled();
    },
  );

  it("still prefetches and registers when the session lookup times out", async () => {
    vi.useFakeTimers();
    try {
      getCookie.mockResolvedValue("better-auth.dev.session_token=valid");
      getSession.mockReturnValue(new Promise(() => undefined));
      const { result } = renderHook(() => useLoginFlow(), { wrapper });

      await act(async () => {
        void start(result.current);
        await vi.advanceTimersByTimeAsync(7_999);
      });
      expect(prefetchOfflineData).not.toHaveBeenCalled();

      await act(() => vi.advanceTimersByTimeAsync(1));
      expect(prefetchOfflineData).toHaveBeenCalledExactlyOnceWith(queryClient, undefined);
      expect(ensureDeviceRegistered).toHaveBeenCalledTimes(1);
      expect(getSession.mock.calls[0][0].fetchOptions.signal.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("skips both when a failed lookup also removed the session token", async () => {
    getCookie.mockResolvedValue("better-auth.dev.session_token=valid");
    getSession.mockImplementation(() => {
      getCookie.mockResolvedValue("");
      return Promise.reject(new Error("offline"));
    });

    await signIn();

    expect(prefetchOfflineData).not.toHaveBeenCalled();
    expect(ensureDeviceRegistered).not.toHaveBeenCalled();
  });

  it("allows a successful second attempt immediately after cancellation", async () => {
    const { result } = renderHook(() => useLoginFlow(), { wrapper });
    await act(async () => {
      await start(result.current);
    });

    getCookie.mockResolvedValue("better-auth.dev.session_token=valid");
    getSession.mockResolvedValue({ data: { user: { id: "user-1" } } });
    await act(async () => {
      await start(result.current);
    });

    expect(social).toHaveBeenCalledTimes(2);
    expect(getSession).toHaveBeenCalledTimes(1);
    expect(prefetchOfflineData).toHaveBeenCalledExactlyOnceWith(queryClient, "user-1");
    expect(ensureDeviceRegistered).toHaveBeenCalledTimes(1);
    expect(toastError).not.toHaveBeenCalled();
  });
});

it("can start ORCID immediately after cancelling GitHub", async () => {
  const { result } = renderHook(() => useLoginFlow(), { wrapper });
  await act(async () => {
    await result.current.startGitHubLogin();
  });

  social.mockImplementationOnce(() => {
    getCookie.mockResolvedValue("better-auth.dev.session_token=valid");
    return Promise.resolve({
      data: { redirect: true, url: "https://orcid.test" },
      error: null,
    });
  });
  getSession.mockResolvedValue({ data: { user: { id: "user-1" } } });
  await act(async () => {
    await result.current.startOrcidLogin();
  });

  expect(social).toHaveBeenCalledTimes(2);
  expect(social).toHaveBeenNthCalledWith(1, { provider: "github", callbackURL: "/" });
  expect(social).toHaveBeenNthCalledWith(2, {
    provider: "orcid",
    callbackURL: "openjii://(tabs)/",
  });
  expect(prefetchOfflineData).toHaveBeenCalledExactlyOnceWith(queryClient, "user-1");
  expect(ensureDeviceRegistered).toHaveBeenCalledTimes(1);
  expect(toastError).not.toHaveBeenCalled();
});

it("still prefetches and registers after a successful email OTP sign-in", async () => {
  emailOtp.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  getCookie.mockResolvedValue("better-auth.dev.session_token=valid");
  getSession.mockResolvedValue({ data: { user: { id: "user-1" } } });
  const { result } = renderHook(() => useLoginFlow(), { wrapper });

  await act(async () => {
    await result.current.verifyEmailOTP("user@example.test", "123456");
  });

  expect(prefetchOfflineData).toHaveBeenCalledExactlyOnceWith(queryClient, "user-1");
  expect(ensureDeviceRegistered).toHaveBeenCalledTimes(1);
});

it("does not prefetch or register after an invalid email OTP", async () => {
  emailOtp.mockResolvedValue({ data: null, error: { message: "Invalid OTP" } });
  const { result } = renderHook(() => useLoginFlow(), { wrapper });

  await act(async () => {
    await result.current.verifyEmailOTP("user@example.test", "000000");
  });

  expect(getSession).not.toHaveBeenCalled();
  expect(prefetchOfflineData).not.toHaveBeenCalled();
  expect(ensureDeviceRegistered).not.toHaveBeenCalled();
});
