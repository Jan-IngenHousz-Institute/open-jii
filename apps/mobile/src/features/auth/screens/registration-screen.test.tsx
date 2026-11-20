import { act, cleanup, fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RegistrationScreen from "~/features/auth/screens/registration-screen";
import auth from "~/shared/i18n/locales/en-US/auth.json";
import { OTPInput } from "~/shared/ui/OTPInput";

const { mutateAsync, logout, sendOtp, verifyOtp, reloadSession, session } = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  reloadSession: vi.fn(),
  logout: vi.fn(),
  sendOtp: vi.fn(),
  verifyOtp: vi.fn(),
  session: { user: { email: "ada@example.com", image: "https://example.test/a.png" } },
}));

vi.mock("~/features/auth/hooks/use-session", () => ({ useSession: () => session }));
vi.mock("~/features/auth/hooks/use-logout", () => ({ useLogout: () => logout }));
vi.mock("~/features/auth/hooks/use-registration", () => ({
  useRegistration: () => ({ mutateAsync, isPending: false }),
}));
vi.mock("~/features/auth/services/auth", () => ({ reloadSessionFromServer: reloadSession }));
vi.mock("~/features/auth/api/login.api", () => ({
  sendEmailLoginOtp: sendOtp,
  verifyEmailLoginOtp: verifyOtp,
}));
vi.mock("~/shared/stores/environment-store", () => ({
  getEnvVar: () => "https://example.test",
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

    expect(verifyOtp).toHaveBeenCalledWith({ email: "ada@example.com", code: "123456" });
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

  it("lets the user sign out to use another account", async () => {
    render(<RegistrationScreen />);

    await settle(() => fireEvent.press(screen.getByText(auth.registration.signOut)));

    expect(logout).toHaveBeenCalledTimes(1);
  });
});
