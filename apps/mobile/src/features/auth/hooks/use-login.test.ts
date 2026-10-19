import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLoginFlow } from "./use-login";

const {
  social,
  oauth2,
  emailOtp,
  getCookie,
  getSession,
  prefetchOfflineData,
  ensureDeviceRegistered,
  toastError,
} = vi.hoisted(() => ({
  social: vi.fn(),
  oauth2: vi.fn(),
  emailOtp: vi.fn(),
  getCookie: vi.fn(),
  getSession: vi.fn(),
  prefetchOfflineData: vi.fn(),
  ensureDeviceRegistered: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("~/features/auth/services/auth", () => ({
  getAuthClient: () => ({
    signIn: { social, oauth2, emailOtp },
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
  social.mockResolvedValue({ data: { redirect: true, url: "https://github.test" }, error: null });
  oauth2.mockResolvedValue({ data: { redirect: true, url: "https://orcid.test" }, error: null });
  getCookie.mockReturnValue("");
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
    "returns silently after cancel with cookie %j and makes no follow-up requests",
    async (cookie) => {
      getCookie.mockReturnValue(cookie);
      const { result } = renderHook(() => useLoginFlow(), { wrapper });

      await act(async () => {
        await start(result.current);
      });

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
    getCookie.mockReturnValue(cookie);
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

  it.each(["returns no user", "fails"])(
    "still prefetches and registers when the session request %s after a token was stored",
    async (outcome) => {
      getCookie.mockReturnValue("better-auth.dev.session_token=valid");
      if (outcome === "fails") {
        getSession.mockRejectedValue(new Error("offline"));
      }
      const { result } = renderHook(() => useLoginFlow(), { wrapper });

      await act(async () => {
        await start(result.current);
      });

      expect(prefetchOfflineData).toHaveBeenCalledExactlyOnceWith(queryClient, undefined);
      expect(ensureDeviceRegistered).toHaveBeenCalledTimes(1);
      expect(toastError).not.toHaveBeenCalled();
    },
  );

  it("allows a successful second attempt immediately after cancellation", async () => {
    const { result } = renderHook(() => useLoginFlow(), { wrapper });
    await act(async () => {
      await start(result.current);
    });

    getCookie.mockReturnValue("better-auth.dev.session_token=valid");
    getSession.mockResolvedValue({ data: { user: { id: "user-1" } } });
    await act(async () => {
      await start(result.current);
    });

    expect(provider === "GitHub" ? social : oauth2).toHaveBeenCalledTimes(2);
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

  oauth2.mockImplementationOnce(() => {
    getCookie.mockReturnValue("better-auth.dev.session_token=valid");
    return Promise.resolve({
      data: { redirect: true, url: "https://orcid.test" },
      error: null,
    });
  });
  getSession.mockResolvedValue({ data: { user: { id: "user-1" } } });
  await act(async () => {
    await result.current.startOrcidLogin();
  });

  expect(social).toHaveBeenCalledExactlyOnceWith({ provider: "github", callbackURL: "/" });
  expect(oauth2).toHaveBeenCalledExactlyOnceWith({
    providerId: "orcid",
    callbackURL: "openjii://(tabs)/",
  });
  expect(prefetchOfflineData).toHaveBeenCalledExactlyOnceWith(queryClient, "user-1");
  expect(ensureDeviceRegistered).toHaveBeenCalledTimes(1);
  expect(toastError).not.toHaveBeenCalled();
});

it("still prefetches and registers after a successful email OTP sign-in", async () => {
  emailOtp.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  getCookie.mockReturnValue("better-auth.dev.session_token=valid");
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
