import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { TouchableOpacity } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginScreen from "~/app/(auth)/login";
import auth from "~/shared/i18n/locales/en-US/auth.json";
import common from "~/shared/i18n/locales/en-US/common.json";
import { Button } from "~/shared/ui/Button";
import { OTPInput } from "~/shared/ui/OTPInput";

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
    expect(buttonDisabled(common.tryAgain)).toBe(false);

    let finishRetry!: (online: boolean) => void;
    probe.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRetry = resolve;
        }),
    );
    fireEvent.press(screen.getByText(common.tryAgain));
    await waitFor(() => expect(screen.getByText(common.checkingConnection)).toBeTruthy());
    expect(probe).toHaveBeenCalledTimes(3);
    expect(buttonDisabled(common.tryAgain)).toBe(true);
    expect(screen.getByText(common.serverUnreachable)).toBeTruthy();

    act(() => finishRetry(true));
    await waitFor(() => expect(screen.queryByText(common.serverUnreachable)).toBeNull());
    expect(screen.queryByText(common.checkingConnection)).toBeNull();
    expect(screen.getByDisplayValue("field@example.test")).toBeTruthy();
    for (const title of [auth.continueWithEmail, auth.github, auth.orcid]) {
      expect(buttonDisabled(title)).toBe(false);
    }
  });

  it("keeps retry available and quiet while a background poll is in flight", async () => {
    probe.mockResolvedValueOnce(false).mockResolvedValueOnce(false);
    probe.mockImplementation(() => new Promise(() => undefined));
    renderLogin();
    await waitFor(() => expect(screen.getByText(common.serverUnreachable)).toBeTruthy());

    await waitFor(() => expect(probe).toHaveBeenCalledTimes(3), { timeout: 3000 });
    expect(screen.queryByText(common.checkingConnection)).toBeNull();
    expect(buttonDisabled(common.tryAgain)).toBe(false);
  });

  it("starts a new probe when Try again is pressed during a pending poll", async () => {
    probe.mockResolvedValueOnce(false).mockResolvedValueOnce(false);
    probe.mockImplementationOnce(() => new Promise(() => undefined));
    renderLogin();
    await waitFor(() => expect(screen.getByText(common.serverUnreachable)).toBeTruthy());
    await waitFor(() => expect(probe).toHaveBeenCalledTimes(3), { timeout: 3000 });

    let finishRetry!: (online: boolean) => void;
    probe.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRetry = resolve;
        }),
    );
    fireEvent.press(screen.getByText(common.tryAgain));
    await waitFor(() => expect(probe).toHaveBeenCalledTimes(4));
    expect(screen.getByText(common.checkingConnection)).toBeTruthy();

    act(() => finishRetry(true));
    await waitFor(() => expect(screen.queryByText(common.serverUnreachable)).toBeNull());
    expect(screen.queryByText(common.checkingConnection)).toBeNull();
  });

  it("keeps the message and retry available when both retry probes fail", async () => {
    probe.mockResolvedValue(false);
    renderLogin();
    await waitFor(() => expect(screen.getByText(common.serverUnreachable)).toBeTruthy());

    fireEvent.press(screen.getByText(common.tryAgain));
    await waitFor(() => expect(probe).toHaveBeenCalledTimes(4));
    await waitFor(() => expect(buttonDisabled(common.tryAgain)).toBe(false));
    expect(screen.getByText(common.serverUnreachable)).toBeTruthy();
    expect(screen.getByPlaceholderText(auth.emailPlaceholder).props.editable).toBe(true);
  });

  it("lets the code be typed while unreachable and submits it once the server answers", async () => {
    vi.useFakeTimers();
    try {
      probe.mockResolvedValue(true);
      renderLogin();
      await act(() => vi.advanceTimersByTimeAsync(0));
      fireEvent.changeText(
        screen.getByPlaceholderText(auth.emailPlaceholder),
        "field@example.test",
      );
      fireEvent.press(screen.getByText(auth.continueWithEmail));
      await act(() => vi.advanceTimersByTimeAsync(0));

      probe.mockResolvedValue(false);
      await act(() => vi.advanceTimersByTimeAsync(2000));
      expect(screen.getByText(common.serverUnreachable)).toBeTruthy();
      const otp = screen.UNSAFE_getByType(OTPInput);
      expect(otp.props.editable).toBe(true);
      await act(() => Promise.resolve(otp.props.onChangeText("123456")));
      expect(verifyEmailOTP).not.toHaveBeenCalled();

      probe.mockResolvedValue(true);
      await act(() => vi.advanceTimersByTimeAsync(2000));
      expect(verifyEmailOTP).toHaveBeenCalledExactlyOnceWith("field@example.test", "123456");
    } finally {
      vi.useRealTimers();
    }
  });
});
