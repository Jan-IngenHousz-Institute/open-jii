import { act, cleanup, fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { AppState, Linking } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RegistrationScreen from "~/features/auth/screens/registration-screen";
import auth from "~/shared/i18n/locales/en-US/auth.json";
import { OTPInput } from "~/shared/ui/OTPInput";

const { mutateAsync, logout, sendOtp, verifyOtp, reloadSession, session, connection, refetch } =
  vi.hoisted(() => ({
    mutateAsync: vi.fn(),
    reloadSession: vi.fn(),
    logout: vi.fn(),
    sendOtp: vi.fn(),
    verifyOtp: vi.fn(),
    session: { user: { email: "ada@example.com", image: "https://example.test/a.png" } },
    connection: { online: true },
    refetch: vi.fn(),
  }));

vi.mock("~/features/auth/hooks/use-session", () => ({ useSession: () => session }));
vi.mock("~/features/auth/hooks/use-logout", () => ({ useLogout: () => logout }));
vi.mock("~/features/auth/hooks/use-registration", () => ({
  useRegistration: () => ({ mutateAsync, isPending: false }),
}));
vi.mock("~/features/auth/services/auth", () => ({ reloadSessionFromServer: reloadSession }));
vi.mock("~/features/auth/api/registration.api", () => ({
  requestRegistrationEmailCode: sendOtp,
  verifyRegistrationEmailCode: verifyOtp,
}));
vi.mock("~/shared/ui/hooks/use-is-online", () => ({
  useIsOnline: () => ({ data: connection.online, refetch }),
}));
vi.mock("~/shared/stores/environment-store", () => ({
  getEnvVar: () => "https://example.test",
  useEnvVar: () => "https://example.test",
}));
vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const path = key.replace(/^auth:/, "").split(".");
      const value = path.reduce<unknown>(
        (node, part) => (node as Record<string, unknown> | undefined)?.[part],
        auth,
      );
      return typeof value === "string" ? value : key;
    },
  }),
}));
vi.mock("@expo/vector-icons/MaterialIcons", () => ({ default: () => null }));

beforeEach(() => {
  session.user.email = "ada@example.com";
  connection.online = true;
  refetch.mockReset().mockResolvedValue(undefined);
  mutateAsync.mockReset().mockResolvedValue(undefined);
  logout.mockReset();
  reloadSession.mockReset().mockResolvedValue(null);
  sendOtp.mockReset().mockResolvedValue({ data: { success: true }, error: null });
  verifyOtp.mockReset().mockResolvedValue({ data: {}, error: null });
});

afterEach(cleanup);

// Lets the promises an action starts settle before asserting.
async function settle(action: () => unknown) {
  await act(async () => {
    action();
    await Promise.resolve();
  });
}

function fillName() {
  fireEvent.changeText(screen.getByPlaceholderText(auth.registration.firstNamePlaceholder), "Ada");
  fireEvent.changeText(
    screen.getByPlaceholderText(auth.registration.lastNamePlaceholder),
    "Lovelace",
  );
  fireEvent.press(screen.getByText(auth.registration.acceptTerms));
}

describe("RegistrationScreen", () => {
  it("explains each missing field instead of submitting", async () => {
    render(<RegistrationScreen />);

    await settle(() => fireEvent.press(screen.getByText(auth.registration.register)));

    expect(screen.getByText(auth.registration.firstNameError)).toBeTruthy();
    expect(screen.getByText(auth.registration.lastNameError)).toBeTruthy();
    expect(screen.getByText(auth.registration.acceptTermsError)).toBeTruthy();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("creates the profile with the trimmed name, avatar and newsletter choice", async () => {
    render(<RegistrationScreen />);
    fillName();
    fireEvent.changeText(
      screen.getByPlaceholderText(auth.registration.firstNamePlaceholder),
      " Ada ",
    );
    fireEvent.press(screen.getByText(auth.registration.newsletterOptIn));

    await settle(() => fireEvent.press(screen.getByText(auth.registration.register)));

    expect(mutateAsync).toHaveBeenCalledWith({
      firstName: "Ada",
      lastName: "Lovelace",
      avatarUrl: "https://example.test/a.png",
      newsletterOptIn: true,
    });
    expect(sendOtp).not.toHaveBeenCalled();
  });

  it("verifies a new email first when the sign-in provider shared none", async () => {
    session.user.email = "0000-0002-1825-0097";
    render(<RegistrationScreen />);
    fireEvent.changeText(screen.getByPlaceholderText(auth.emailPlaceholder), " Ada@Example.com ");
    fillName();

    await settle(() =>
      fireEvent.press(screen.getByText(auth.registration.continueWithEmailVerification)),
    );
    expect(sendOtp).toHaveBeenCalledWith("ada@example.com");
    expect(mutateAsync).not.toHaveBeenCalled();

    await settle(() => screen.UNSAFE_getByType(OTPInput).props.onChangeText("123456"));

    expect(verifyOtp).toHaveBeenCalledWith("ada@example.com", "123456");
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: "Ada", lastName: "Lovelace" }),
    );
  });

  async function reachCodeStep() {
    session.user.email = "0000-0002-1825-0097";
    render(<RegistrationScreen />);
    fireEvent.changeText(screen.getByPlaceholderText(auth.emailPlaceholder), "ada@example.com");
    fillName();
    await settle(() =>
      fireEvent.press(screen.getByText(auth.registration.continueWithEmailVerification)),
    );
  }

  it("shows the connection problem without submitting or blocking account switching", async () => {
    connection.online = false;
    const { rerender } = render(<RegistrationScreen />);
    fillName();

    expect(screen.getByText("serverUnreachable")).toBeTruthy();
    await settle(() => fireEvent.press(screen.getByText(auth.registration.register)));
    expect(mutateAsync).not.toHaveBeenCalled();
    await settle(() => fireEvent.press(screen.getByText(auth.registration.signOut)));
    expect(logout).toHaveBeenCalledTimes(1);
    await settle(() => fireEvent.press(screen.getByText("retry")));
    expect(refetch).toHaveBeenCalledTimes(1);

    connection.online = true;
    rerender(<RegistrationScreen />);
    expect(screen.queryByText("serverUnreachable")).toBeNull();
    await settle(() => fireEvent.press(screen.getByText(auth.registration.register)));
    expect(mutateAsync).toHaveBeenCalledTimes(1);
  });

  it("keeps a code entered offline so it can be submitted when the connection returns", async () => {
    session.user.email = "0000-0002-1825-0097";
    const { rerender } = render(<RegistrationScreen />);
    fireEvent.changeText(screen.getByPlaceholderText(auth.emailPlaceholder), "ada@example.com");
    fillName();
    await settle(() =>
      fireEvent.press(screen.getByText(auth.registration.continueWithEmailVerification)),
    );

    connection.online = false;
    rerender(<RegistrationScreen />);
    await settle(() => screen.UNSAFE_getByType(OTPInput).props.onChangeText("123456"));
    expect(verifyOtp).not.toHaveBeenCalled();

    connection.online = true;
    rerender(<RegistrationScreen />);
    await settle(() => fireEvent.press(screen.getByText(auth.registration.verifyAndRegister)));
    expect(verifyOtp).toHaveBeenCalledExactlyOnceWith("ada@example.com", "123456");
  });

  it("keeps the user on the code step when the code is wrong", async () => {
    verifyOtp.mockResolvedValue({
      data: null,
      error: { code: "INVALID_OTP", message: "Invalid OTP" },
    });
    await reachCodeStep();

    await settle(() => screen.UNSAFE_getByType(OTPInput).props.onChangeText("000000"));

    expect(screen.getByText(auth.errors.expiredOtp)).toBeTruthy();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("shows the server's reason when the email belongs to another account", async () => {
    const message = "This email is already associated with another account";
    verifyOtp.mockResolvedValue({ data: null, error: { status: 400, message } });
    await reachCodeStep();

    await settle(() => screen.UNSAFE_getByType(OTPInput).props.onChangeText("123456"));

    expect(screen.getByText(message)).toBeTruthy();
  });

  it("retries a failed profile save without spending the code again", async () => {
    mutateAsync.mockRejectedValueOnce(new Error("Internal Server Error"));
    await reachCodeStep();
    await settle(() => screen.UNSAFE_getByType(OTPInput).props.onChangeText("123456"));
    expect(screen.queryByText(auth.errors.verifyFailed)).toBeNull();

    await settle(() => fireEvent.press(screen.getByText(auth.registration.register)));

    expect(verifyOtp).toHaveBeenCalledTimes(1);
    expect(mutateAsync).toHaveBeenCalledTimes(2);
  });

  it("says so when the code cannot be sent", async () => {
    session.user.email = "0000-0002-1825-0097";
    sendOtp.mockRejectedValue(new Error("Network request failed"));
    render(<RegistrationScreen />);
    fireEvent.changeText(screen.getByPlaceholderText(auth.emailPlaceholder), "ada@example.com");
    fillName();

    await settle(() =>
      fireEvent.press(screen.getByText(auth.registration.continueWithEmailVerification)),
    );

    expect(screen.getByText(auth.errors.sendFailed)).toBeTruthy();
  });

  it("re-checks the session with the server when it opens", () => {
    render(<RegistrationScreen />);

    expect(reloadSession).toHaveBeenCalledTimes(1);
  });

  it("re-checks the session when the app returns to the foreground, tolerating a failed read", async () => {
    reloadSession.mockRejectedValue(new Error("Network request failed"));
    const listen = vi.spyOn(AppState, "addEventListener");
    render(<RegistrationScreen />);
    const onChange = listen.mock.calls.at(-1)?.[1];

    await settle(() => onChange?.("background"));
    expect(reloadSession).toHaveBeenCalledTimes(1);

    await settle(() => onChange?.("active"));
    expect(reloadSession).toHaveBeenCalledTimes(2);
    listen.mockRestore();
  });

  it("clears a field's error as soon as the person types in it", async () => {
    render(<RegistrationScreen />);
    await settle(() => fireEvent.press(screen.getByText(auth.registration.register)));

    fireEvent.changeText(screen.getByPlaceholderText(auth.registration.firstNamePlaceholder), "A");

    expect(screen.queryByText(auth.registration.firstNameError)).toBeNull();
    expect(screen.getByText(auth.registration.lastNameError)).toBeTruthy();
  });

  it("opens the terms and conditions on the web", () => {
    const openURL = vi.spyOn(Linking, "openURL").mockResolvedValue(true);
    render(<RegistrationScreen />);

    fireEvent.press(screen.getByText(auth.registration.readTerms));

    expect(openURL).toHaveBeenCalledWith("https://example.test/terms-and-conditions");
    openURL.mockRestore();
  });

  it("shows the server's reason under the email when the code is refused", async () => {
    session.user.email = "0000-0002-1825-0097";
    sendOtp.mockResolvedValue({ data: null, error: { message: "Too many requests" } });
    render(<RegistrationScreen />);
    fireEvent.changeText(screen.getByPlaceholderText(auth.emailPlaceholder), "ada@example.com");
    fillName();

    await settle(() =>
      fireEvent.press(screen.getByText(auth.registration.continueWithEmailVerification)),
    );

    expect(screen.getByText("Too many requests")).toBeTruthy();
    expect(screen.queryByText(auth.checkEmailTitle)).toBeNull();
  });

  it("says the code could not be verified when the request itself fails", async () => {
    verifyOtp.mockRejectedValue(new Error("Network request failed"));
    await reachCodeStep();

    await settle(() => screen.UNSAFE_getByType(OTPInput).props.onChangeText("123456"));

    expect(screen.getByText(auth.errors.verifyFailed)).toBeTruthy();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("goes back to the form from the code step", async () => {
    await reachCodeStep();

    fireEvent.press(screen.getByLabelText(auth.registration.back));

    expect(screen.getByText(auth.registration.title)).toBeTruthy();
  });

  it("offers a new code once the 30-second wait is over", async () => {
    vi.useFakeTimers();
    try {
      await reachCodeStep();
      expect(screen.getByText("Re-send code ({{seconds}}s)")).toBeTruthy();

      for (let second = 0; second < 30; second++) {
        act(() => vi.advanceTimersByTime(1000));
      }
      await settle(() => fireEvent.press(screen.getByText(auth.resendCode)));

      expect(sendOtp).toHaveBeenCalledTimes(2);
      expect(screen.getByText("Re-send code ({{seconds}}s)")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("lets the user sign out to use another account", async () => {
    render(<RegistrationScreen />);

    await settle(() => fireEvent.press(screen.getByText(auth.registration.signOut)));

    expect(logout).toHaveBeenCalledTimes(1);
  });
});
