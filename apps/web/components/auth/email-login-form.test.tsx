import { render, screen, userEvent } from "@/test/test-utils";
import { fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { EmailLoginForm } from "./email-login-form";

// Hoisted mocks
const {
  mockSignInEmailMutate,
  mockVerifyEmailMutate,
  mockPush,
  mockSignInIsPendingRef,
  mockVerifyIsPendingRef,
} = vi.hoisted(() => ({
  mockSignInEmailMutate: vi.fn(),
  mockVerifyEmailMutate: vi.fn(),
  mockPush: vi.fn(),
  mockSignInIsPendingRef: { current: false },
  mockVerifyIsPendingRef: { current: false },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("~/hooks/auth/useSignInEmail/useSignInEmail", () => ({
  useSignInEmail: () => ({
    mutateAsync: mockSignInEmailMutate,
    get isPending() {
      return mockSignInIsPendingRef.current;
    },
  }),
}));

vi.mock("~/hooks/auth/useVerifyEmail/useVerifyEmail", () => ({
  useVerifyEmail: () => ({
    mutateAsync: mockVerifyEmailMutate,
    get isPending() {
      return mockVerifyIsPendingRef.current;
    },
  }),
}));

// InputOTP doesn't work well in jsdom, provide a testable shim
vi.mock("@repo/ui/components", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@repo/ui/components");
  return {
    ...actual,
    InputOTP: ({
      children,
      maxLength,
      onComplete,
      value,
      onChange,
    }: {
      children: React.ReactNode;
      maxLength: number;
      pattern?: string;
      containerClassName?: string;
      onComplete?: () => void;
      value?: string;
      onChange?: (v: string) => void;
    }) => (
      <div data-testid="input-otp" data-maxlength={maxLength}>
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange?.(e.target.value);
            if (e.target.value.length === maxLength) onComplete?.();
          }}
          maxLength={maxLength}
          data-testid="otp-input"
        />
        {children}
      </div>
    ),
    InputOTPGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    InputOTPSlot: ({ index }: { index: number }) => <div data-testid={`otp-slot-${index}`} />,
  };
});

const defaultProps = {
  callbackUrl: "/platform",
  locale: "en-US",
  onShowOTPChange: vi.fn(),
};

async function submitEmail(email = "test@example.com") {
  const user = userEvent.setup();
  const emailInput = screen.getByPlaceholderText("auth.emailPlaceholder");
  await user.type(emailInput, email);
  await user.click(screen.getByText("auth.continueWithEmail"));
  await waitFor(() => expect(mockSignInEmailMutate).toHaveBeenCalledWith(email));
  await waitFor(() => expect(screen.getByText("auth.checkEmail")).toBeInTheDocument());
  return user;
}

function submitOTP(value = "123456") {
  fireEvent.change(screen.getByTestId("otp-input"), { target: { value } });
}

describe("EmailLoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignInIsPendingRef.current = false;
    mockVerifyIsPendingRef.current = false;
    mockSignInEmailMutate.mockResolvedValue({ error: null });
    mockVerifyEmailMutate.mockResolvedValue({
      error: null,
      data: { user: { registered: true } },
    });
  });

  it("renders email input form initially", () => {
    render(<EmailLoginForm {...defaultProps} />);
    expect(screen.getByPlaceholderText("auth.emailPlaceholder")).toBeInTheDocument();
    expect(screen.getByText("auth.continueWithEmail")).toBeInTheDocument();
  });

  it("shows OTP form after successful email submission", async () => {
    render(<EmailLoginForm {...defaultProps} />);
    await submitEmail();
    expect(defaultProps.onShowOTPChange).toHaveBeenCalledWith(true);
  });

  it("allows editing email from OTP screen", async () => {
    render(<EmailLoginForm {...defaultProps} />);
    const user = await submitEmail();
    await user.click(screen.getByRole("button", { name: /edit email/i }));
    expect(defaultProps.onShowOTPChange).toHaveBeenCalledWith(false);
    expect(screen.getByText("auth.continueWithEmail")).toBeInTheDocument();
  });

  it("redirects to registration when user is not registered", async () => {
    mockVerifyEmailMutate.mockResolvedValue({
      error: null,
      data: { user: { registered: false } },
    });
    render(<EmailLoginForm {...defaultProps} />);
    await submitEmail();
    submitOTP();
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/en-US/register?callbackUrl=%2Fplatform"));
  });

  it("redirects to callback URL when user is registered", async () => {
    render(<EmailLoginForm {...defaultProps} />);
    await submitEmail();
    submitOTP();
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/platform"));
  });

  it("handles OTP verification error", async () => {
    mockVerifyEmailMutate.mockRejectedValue(new Error("Invalid code"));
    render(<EmailLoginForm {...defaultProps} />);
    await submitEmail();
    submitOTP();
    await waitFor(() => expect(mockVerifyEmailMutate).toHaveBeenCalled());
  });

  it("handles OTP verification error from response", async () => {
    mockVerifyEmailMutate.mockResolvedValue({ error: { message: "Invalid OTP" }, data: null });
    render(<EmailLoginForm {...defaultProps} />);
    await submitEmail();
    submitOTP();
    await waitFor(() => expect(mockVerifyEmailMutate).toHaveBeenCalled());
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("works without onShowOTPChange callback", async () => {
    render(<EmailLoginForm callbackUrl="/platform" locale="en-US" onShowOTPChange={undefined} />);
    await submitEmail();
    // No crash
  });

  it("does not show OTP form on email send error", async () => {
    mockSignInEmailMutate.mockResolvedValue({ error: { message: "Email failed" } });
    const user = userEvent.setup();
    render(<EmailLoginForm {...defaultProps} />);
    await user.type(screen.getByPlaceholderText("auth.emailPlaceholder"), "test@example.com");
    await user.click(screen.getByText("auth.continueWithEmail"));
    await waitFor(() => expect(mockSignInEmailMutate).toHaveBeenCalled());
    expect(screen.queryByText("auth.checkEmail")).not.toBeInTheDocument();
  });

  it("disables submit button when email is invalid", async () => {
    const user = userEvent.setup();
    render(<EmailLoginForm {...defaultProps} />);
    await user.type(screen.getByPlaceholderText("auth.emailPlaceholder"), "invalid");
    await waitFor(() => expect(screen.getByText("auth.continueWithEmail")).toBeDisabled());
  });

  it("enables submit button when email is valid", async () => {
    const user = userEvent.setup();
    render(<EmailLoginForm {...defaultProps} />);
    await user.type(screen.getByPlaceholderText("auth.emailPlaceholder"), "test@example.com");
    await waitFor(() => expect(screen.getByText("auth.continueWithEmail")).not.toBeDisabled());
  });

  it("disables resend button during countdown", async () => {
    render(<EmailLoginForm {...defaultProps} />);
    await submitEmail();
    const resendButton = screen.getByRole("button", { name: /resend code/i });
    expect(resendButton).toBeDisabled();
    expect(resendButton.textContent).toContain("(30s)");
  });

  it("prevents double submission when already pending", async () => {
    mockSignInEmailMutate.mockImplementation(() => {
      mockSignInIsPendingRef.current = true;
      return new Promise((resolve) =>
        setTimeout(() => {
          resolve({ error: null });
          mockSignInIsPendingRef.current = false;
        }, 100),
      );
    });
    const user = userEvent.setup();
    render(<EmailLoginForm {...defaultProps} />);
    await user.type(screen.getByPlaceholderText("auth.emailPlaceholder"), "test@example.com");
    const btn = screen.getByText("auth.continueWithEmail");
    await user.click(btn);
    await user.click(btn);
    await waitFor(() => expect(mockSignInEmailMutate).toHaveBeenCalledTimes(1));
  });

  it("handles resend code after countdown with error", async () => {
    mockSignInEmailMutate.mockResolvedValue({ error: null });
    render(<EmailLoginForm {...defaultProps} />);
    await submitEmail();

    mockSignInEmailMutate.mockRejectedValue(new Error("Resend failed"));
    vi.useFakeTimers();
    vi.advanceTimersByTime(30000);
    vi.useRealTimers();

    const user = userEvent.setup();
    const resendButton = screen.getByRole("button", { name: /resend code/i });
    await user.click(resendButton);
    await waitFor(() => expect(mockSignInEmailMutate).toHaveBeenCalledWith("test@example.com"));
  });
});
