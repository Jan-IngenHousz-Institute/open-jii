import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { TouchableOpacity } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginScreen from "~/features/auth/screens/login-screen";
import { hasExpiredGuestSession } from "~/features/auth/services/session-cache";
import auth from "~/shared/i18n/locales/en-US/auth.json";
import common from "~/shared/i18n/locales/en-US/common.json";
import { deferred } from "~/shared/testing/deferred";
import { Button } from "~/shared/ui/Button";
import { OTPInput } from "~/shared/ui/OTPInput";

vi.mock("~/features/auth/services/auth", () => ({ getAuthClient: () => ({ $fetch: vi.fn() }) }));
vi.mock("~/features/auth/services/session-cache", () => ({
  acceptNewSession: vi.fn(),
  hasExpiredGuestSession: vi.fn(() => false),
}));

const { probe, verifyEmailOTP } = vi.hoisted(() => ({
  probe: vi.fn<() => Promise<boolean>>(),
  verifyEmailOTP: vi.fn(),
}));

vi.mock("~/shared/device/is-online", () => ({ isOnline: probe }));
vi.mock("~/features/auth/hooks/use-login", () => ({
  useLoginFlow: () => ({
    startGitHubLogin: vi.fn(),
    startOrcidLogin: vi.fn(),
    sendEmailOTP: vi.fn(),
    verifyEmailOTP,
    githubLoading: false,
    orcidLoading: false,
    emailLoading: false,
    verifyLoading: false,
  }),
}));
vi.mock("~/features/profile/widgets/environment-selector", () => ({
  EnvironmentSelector: () => null,
}));
vi.mock("~/shared/stores/environment-store", () => ({
  getEnvVar: () => "https://example.test",
}));
vi.mock("~/shared/i18n", () => ({
  useTranslation: (namespace?: string) => ({
    t: (key: string) => {
      const authKey = key.startsWith("auth:") ? key.slice(5) : key;
      if (authKey === "demo.expired") return auth.demo.expired;
      const labels: Record<string, unknown> =
        key.startsWith("auth:") || namespace === "auth" ? auth : common;
      return labels[authKey] ?? key;
    },
  }),
}));
vi.mock("@expo/vector-icons/MaterialIcons", () => ({ default: () => null }));
vi.mock("react-native-svg", () => ({ default: () => null, Path: () => null }));

let client: QueryClient;

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  probe.mockReset();
  vi.mocked(hasExpiredGuestSession).mockReturnValue(false);
  verifyEmailOTP.mockReset();
});

afterEach(() => {
  cleanup();
  client.clear();
});

function renderLogin() {
  return render(
    <QueryClientProvider client={client}>
      <LoginScreen />
    </QueryClientProvider>,
  );
}

function buttonDisabled(title: string) {
  const button = screen.UNSAFE_getAllByType(Button).find((node) => node.props.title === title);
  expect(button).toBeDefined();
  return button?.findByType(TouchableOpacity).props.disabled;
}

describe("login connection message", () => {
  it("keeps email editable and offers an immediate retry with visible progress and recovery", async () => {
    probe.mockResolvedValueOnce(false).mockResolvedValueOnce(false);
    renderLogin();
    await waitFor(() => expect(screen.getByText(common.serverUnreachable)).toBeTruthy());

    const email = screen.getByPlaceholderText(auth.emailPlaceholder);
    expect(email.props.editable).toBe(true);
    fireEvent.changeText(email, "field@example.test");
    expect(screen.getByDisplayValue("field@example.test")).toBeTruthy();
    for (const title of [auth.continueWithEmail, auth.github, auth.orcid]) {
      expect(buttonDisabled(title)).toBe(true);
    }
    expect(buttonDisabled(common.retry)).toBe(false);

    const retry = deferred<boolean>();
    probe.mockReturnValueOnce(retry.promise);
    fireEvent.press(screen.getByText(common.retry));
    await waitFor(() => expect(screen.getByText(common.checkingConnection)).toBeTruthy());
    expect(probe).toHaveBeenCalledTimes(3);
    expect(buttonDisabled(common.retry)).toBe(true);
    expect(screen.getByText(common.serverUnreachable)).toBeTruthy();

    act(() => retry.resolve(true));
    await waitFor(() => expect(screen.queryByText(common.serverUnreachable)).toBeNull());
    expect(screen.queryByText(common.checkingConnection)).toBeNull();
    expect(screen.getByDisplayValue("field@example.test")).toBeTruthy();
    for (const title of [auth.continueWithEmail, auth.github, auth.orcid]) {
      expect(buttonDisabled(title)).toBe(false);
    }
  });

  it("keeps the message and retry available when both retry probes fail", async () => {
    probe.mockResolvedValue(false);
    renderLogin();
    await waitFor(() => expect(screen.getByText(common.serverUnreachable)).toBeTruthy());

    fireEvent.press(screen.getByText(common.retry));
    await waitFor(() => expect(probe).toHaveBeenCalledTimes(4));
    await waitFor(() => expect(buttonDisabled(common.retry)).toBe(false));
    expect(screen.getByText(common.serverUnreachable)).toBeTruthy();
    expect(screen.getByPlaceholderText(auth.emailPlaceholder).props.editable).toBe(true);
  });
});

describe("login connection polling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

  async function renderUnreachableWithPendingPoll() {
    probe.mockResolvedValueOnce(false).mockResolvedValueOnce(false);
    probe.mockReturnValueOnce(deferred<boolean>().promise);
    renderLogin();
    await advance(0);
    expect(screen.getByText(common.serverUnreachable)).toBeTruthy();
    await advance(2000);
    expect(probe).toHaveBeenCalledTimes(3);
  }

  it("keeps retry available and quiet while a background poll is in flight", async () => {
    await renderUnreachableWithPendingPoll();

    expect(screen.queryByText(common.checkingConnection)).toBeNull();
    expect(buttonDisabled(common.retry)).toBe(false);
  });

  it("starts a new probe when Try again is pressed during a pending poll", async () => {
    await renderUnreachableWithPendingPoll();

    const retry = deferred<boolean>();
    probe.mockReturnValueOnce(retry.promise);
    fireEvent.press(screen.getByText(common.retry));
    await advance(0);
    expect(probe).toHaveBeenCalledTimes(4);
    expect(screen.getByText(common.checkingConnection)).toBeTruthy();

    retry.resolve(true);
    await advance(0);
    expect(screen.queryByText(common.serverUnreachable)).toBeNull();
    expect(screen.queryByText(common.checkingConnection)).toBeNull();
  });

  it("lets the code be typed while unreachable and submits it once the server answers", async () => {
    probe.mockResolvedValue(true);
    renderLogin();
    await advance(0);
    fireEvent.changeText(screen.getByPlaceholderText(auth.emailPlaceholder), "field@example.test");
    fireEvent.press(screen.getByText(auth.continueWithEmail));
    await advance(0);

    probe.mockResolvedValue(false);
    await advance(2000);
    expect(screen.getByText(common.serverUnreachable)).toBeTruthy();
    const otp = screen.UNSAFE_getByType(OTPInput);
    expect(otp.props.editable).toBe(true);
    await act(() => Promise.resolve(otp.props.onChangeText("123456")));
    expect(verifyEmailOTP).not.toHaveBeenCalled();

    probe.mockResolvedValue(true);
    await advance(2000);
    expect(verifyEmailOTP).toHaveBeenCalledExactlyOnceWith("field@example.test", "123456");
  });
});

it("accepts OTP success for a new account without a registration screen", async () => {
  probe.mockResolvedValue(true);
  verifyEmailOTP.mockResolvedValue({
    data: { user: { id: "new-user", registered: false } },
    error: null,
  });
  renderLogin();
  await waitFor(() => expect(buttonDisabled(auth.continueWithEmail)).toBe(false));
  fireEvent.changeText(screen.getByPlaceholderText(auth.emailPlaceholder), "new@example.test");
  fireEvent.press(screen.getByText(auth.continueWithEmail));
  await waitFor(() => expect(screen.UNSAFE_getByType(OTPInput)).toBeTruthy());
  const otp = screen.UNSAFE_getByType(OTPInput);
  await act(() => Promise.resolve(otp.props.onChangeText("123456")));
  await waitFor(() =>
    expect(verifyEmailOTP).toHaveBeenCalledExactlyOnceWith("new@example.test", "123456"),
  );
  expect(screen.queryByText("errors.expiredOtp")).toBeNull();
});

it("explains an expired guest session before offering a new demo entry", () => {
  vi.mocked(hasExpiredGuestSession).mockReturnValue(true);
  renderLogin();
  expect(screen.getByText(auth.demo.expired)).toBeTruthy();
});
