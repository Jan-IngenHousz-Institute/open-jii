import { act, cleanup, fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RegistrationScreen from "~/features/auth/screens/registration-screen";
import auth from "~/shared/i18n/locales/en-US/auth.json";
import { OTPInput } from "~/shared/ui/OTPInput";

const { mutateAsync, logout, sendOtp, verifyOtp, session } = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
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
    fireEvent.changeText(screen.getByPlaceholderText(auth.emailPlaceholder), "ada@example.com");
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

  it("keeps the user on the code step when the code is wrong", async () => {
    session.user.email = "0000-0002-1825-0097";
    verifyOtp.mockResolvedValue({ data: null, error: { message: "Invalid OTP" } });
    render(<RegistrationScreen />);
    fireEvent.changeText(screen.getByPlaceholderText(auth.emailPlaceholder), "ada@example.com");
    fillName();
    await settle(() =>
      fireEvent.press(screen.getByText(auth.registration.continueWithEmailVerification)),
    );

    await settle(() => screen.UNSAFE_getByType(OTPInput).props.onChangeText("000000"));

    expect(screen.getByText(auth.errors.expiredOtp)).toBeTruthy();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("lets the user sign out to use another account", async () => {
    render(<RegistrationScreen />);

    await settle(() => fireEvent.press(screen.getByText(auth.registration.signOut)));

    expect(logout).toHaveBeenCalledTimes(1);
  });
});
