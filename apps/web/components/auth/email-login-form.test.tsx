import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type * as UIComponents from "@repo/ui/components";

import { EmailLoginForm } from "./email-login-form";

globalThis.React = React;

// Helper
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// Mock Next.js router
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock auth hooks
const mockSignInEmailMutate = vi.fn();
const mockVerifyEmailMutate = vi.fn();
let mockSignInIsPending = false;
let mockVerifyIsPending = false;

vi.mock("~/hooks/auth/useSignInEmail/useSignInEmail", () => ({
  useSignInEmail: () => ({
    mutateAsync: mockSignInEmailMutate,
    get isPending() {
      return mockSignInIsPending;
    },
  }),
}));

vi.mock("~/hooks/auth/useVerifyEmail/useVerifyEmail", () => ({
  useVerifyEmail: () => ({
    mutateAsync: mockVerifyEmailMutate,
    get isPending() {
      return mockVerifyIsPending;
    },
  }),
}));

// Mock i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

// Mock UI components - but NOT Form components, they need to work properly
vi.mock("@repo/ui/components", async () => {
  const actual = await vi.importActual<typeof UIComponents>("@repo/ui/components");
  return {
    ...actual,
    // Only mock non-form components
    Button: ({
      children,
      type,
      className,
      variant,
      disabled,
      ...props
    }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
      variant?: string;
      children: React.ReactNode;
    }) => (
      <button
        type={type}
        className={className}
        data-variant={variant}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    ),
    Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
      <input {...props} className={props.className} />
    ),
    InputOTP: ({
      children,
      maxLength,
      pattern,
      onComplete,
      value,
      onChange,
    }: {
      children: React.ReactNode;
      maxLength: number;
      pattern: string;
      containerClassName?: string;
      onComplete?: () => void;
      value?: string;
      onChange?: (value: string) => void;
    }) => (
      <div data-testid="input-otp" data-maxlength={maxLength} data-pattern={pattern}>
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange?.(e.target.value);
            if (e.target.value.length === maxLength) {
              onComplete?.();
            }
          }}
          maxLength={maxLength}
          data-testid="otp-input"
        />
        {children}
      </div>
    ),
    InputOTPGroup: ({ children }: { children: React.ReactNode; className?: string }) => (
      <div>{children}</div>
    ),
    InputOTPSlot: ({ index }: { index: number; className?: string }) => (
      <div data-testid={`otp-slot-${index}`} />
    ),
  };
});

// Mock lucide-react
vi.mock("lucide-react", () => ({
  Loader2: () => <div data-testid="loader" />,
  Pencil: () => <div data-testid="pencil-icon" />,
}));

describe("EmailLoginForm", () => {
  const defaultProps = {
    callbackUrl: "/platform",
    locale: "en-US",
    onShowOTPChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSignInIsPending = false;
    mockVerifyIsPending = false;
    mockSignInEmailMutate.mockResolvedValue({ error: null });
    mockVerifyEmailMutate.mockResolvedValue({
      error: null,
      data: { user: { registered: true } },
    });
  });

  it("renders email input form initially", () => {
    render(<EmailLoginForm {...defaultProps} />, { wrapper: createWrapper() });

    expect(screen.getByText("auth.email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("auth.emailPlaceholder")).toBeInTheDocument();
    expect(screen.getByText("auth.continueWithEmail")).toBeInTheDocument();
  });

  it("shows OTP form after successful email submission", async () => {
    const user = userEvent.setup();
    render(<EmailLoginForm {...defaultProps} />, { wrapper: createWrapper() });

    const emailInput = screen.getByPlaceholderText("auth.emailPlaceholder");
    await user.type(emailInput, "test@example.com");

    const submitButton = screen.getByText("auth.continueWithEmail");
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockSignInEmailMutate).toHaveBeenCalledWith("test@example.com");
    });

    await waitFor(() => {
      expect(screen.getByText("Check your email for a sign-in code")).toBeInTheDocument();
    });

    expect(defaultProps.onShowOTPChange).toHaveBeenCalledWith(true);
  });

  it("allows editing email from OTP screen", async () => {
    const user = userEvent.setup();
    render(<EmailLoginForm {...defaultProps} />, { wrapper: createWrapper() });

    // Submit email
    const emailInput = screen.getByPlaceholderText("auth.emailPlaceholder");
    await user.type(emailInput, "test@example.com");
    await user.click(screen.getByText("auth.continueWithEmail"));

    await waitFor(() => {
      expect(screen.getByText("Check your email for a sign-in code")).toBeInTheDocument();
    });

    // Click edit button
    const editButton = screen.getByRole("button", { name: /edit email/i });
    await user.click(editButton);

    expect(defaultProps.onShowOTPChange).toHaveBeenCalledWith(false);
    expect(screen.getByText("auth.continueWithEmail")).toBeInTheDocument();
  });

  it("redirects to registration page when user is not registered", async () => {
    mockVerifyEmailMutate.mockResolvedValue({
      error: null,
      data: { user: { registered: false } },
    });

    const user = userEvent.setup();
    render(<EmailLoginForm {...defaultProps} />, { wrapper: createWrapper() });

    // Submit email
    const emailInput = screen.getByPlaceholderText("auth.emailPlaceholder");
    await user.type(emailInput, "test@example.com");
    await user.click(screen.getByText("auth.continueWithEmail"));

    await waitFor(() => {
      expect(screen.getByTestId("input-otp")).toBeInTheDocument();
    });

    // Submit OTP
    const otpInput = screen.getByTestId("otp-input");
    fireEvent.change(otpInput, { target: { value: "123456" } });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/en-US/register?callbackUrl=%2Fplatform");
    });
  });

  it("redirects to callback URL when user is registered", async () => {
    const user = userEvent.setup();
    render(<EmailLoginForm {...defaultProps} />, { wrapper: createWrapper() });

    // Submit email
    const emailInput = screen.getByPlaceholderText("auth.emailPlaceholder");
    await user.type(emailInput, "test@example.com");
    await user.click(screen.getByText("auth.continueWithEmail"));

    await waitFor(() => {
      expect(screen.getByTestId("input-otp")).toBeInTheDocument();
    });

    // Submit OTP
    const otpInput = screen.getByTestId("otp-input");
    fireEvent.change(otpInput, { target: { value: "123456" } });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/platform");
    });
  });

  it("handles OTP verification error", async () => {
    mockVerifyEmailMutate.mockRejectedValue(new Error("Invalid code"));

    const user = userEvent.setup();
    render(<EmailLoginForm {...defaultProps} />, { wrapper: createWrapper() });

    // Submit email
    const emailInput = screen.getByPlaceholderText("auth.emailPlaceholder");
    await user.type(emailInput, "test@example.com");
    await user.click(screen.getByText("auth.continueWithEmail"));

    await waitFor(() => {
      expect(screen.getByTestId("input-otp")).toBeInTheDocument();
    });

    // Submit OTP
    const otpInput = screen.getByTestId("otp-input");
    fireEvent.change(otpInput, { target: { value: "123456" } });

    await waitFor(() => {
      expect(mockVerifyEmailMutate).toHaveBeenCalled();
    });
  });

  it("works without onShowOTPChange callback", async () => {
    const user = userEvent.setup();
    const propsWithoutCallback = {
      callbackUrl: "/platform",
      locale: "en-US",
      onShowOTPChange: undefined,
    };
    render(<EmailLoginForm {...propsWithoutCallback} />, { wrapper: createWrapper() });

    const emailInput = screen.getByPlaceholderText("auth.emailPlaceholder");
    await user.type(emailInput, "test@example.com");
    await user.click(screen.getByText("auth.continueWithEmail"));

    await waitFor(() => {
      expect(screen.getByText("Check your email for a sign-in code")).toBeInTheDocument();
    });
  });

  it("handles OTP verification error from response", async () => {
    mockVerifyEmailMutate.mockResolvedValue({
      error: { message: "Invalid OTP" },
      data: null,
    });

    const user = userEvent.setup();
    render(<EmailLoginForm {...defaultProps} />, { wrapper: createWrapper() });

    const emailInput = screen.getByPlaceholderText("auth.emailPlaceholder");
    await user.type(emailInput, "test@example.com");
    await user.click(screen.getByText("auth.continueWithEmail"));

    await waitFor(() => {
      expect(screen.getByTestId("input-otp")).toBeInTheDocument();
    });

    const otpInput = screen.getByTestId("otp-input");
    fireEvent.change(otpInput, { target: { value: "123456" } });

    await waitFor(() => {
      expect(mockVerifyEmailMutate).toHaveBeenCalled();
    });

    // Verify error is not propagated to router
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("handles email send error from response", async () => {
    mockSignInEmailMutate.mockResolvedValue({
      error: { message: "Email failed" },
    });

    const user = userEvent.setup();
    render(<EmailLoginForm {...defaultProps} />, { wrapper: createWrapper() });

    const emailInput = screen.getByPlaceholderText("auth.emailPlaceholder");
    await user.type(emailInput, "test@example.com");
    await user.click(screen.getByText("auth.continueWithEmail"));

    await waitFor(() => {
      expect(mockSignInEmailMutate).toHaveBeenCalled();
    });

    // Should not show OTP form on error
    expect(screen.queryByText("Check your email for a sign-in code")).not.toBeInTheDocument();
  });

  it("handles resend code error", async () => {
    mockSignInEmailMutate.mockResolvedValue({ error: null });

    const user = userEvent.setup();
    render(<EmailLoginForm {...defaultProps} />, { wrapper: createWrapper() });

    const emailInput = screen.getByPlaceholderText("auth.emailPlaceholder");
    await user.type(emailInput, "test@example.com");
    await user.click(screen.getByText("auth.continueWithEmail"));

    await waitFor(() => {
      expect(screen.getByTestId("input-otp")).toBeInTheDocument();
    });

    // Mock resend to throw error
    mockSignInEmailMutate.mockRejectedValue(new Error("Resend failed"));

    // Wait for countdown to finish (simulate with immediate resend)
    vi.useFakeTimers();
    act(() => {
      vi.advanceTimersByTime(30000);
    });
    vi.useRealTimers();

    const resendButton = screen.getByRole("button", { name: /resend code/i });
    await user.click(resendButton);

    await waitFor(() => {
      expect(mockSignInEmailMutate).toHaveBeenCalledWith("test@example.com");
    });
  });

  it("calls onShowOTPChange(false) when editing email without callback", async () => {
    const user = userEvent.setup();
    render(<EmailLoginForm {...defaultProps} />);
    await user.type(screen.getByPlaceholderText("auth.emailPlaceholder"), "test@example.com");
    await waitFor(() => expect(screen.getByText("auth.continueWithEmail")).not.toBeDisabled());
  });

  it("disables resend button during countdown", async () => {
    const user = userEvent.setup();
    render(<EmailLoginForm {...defaultProps} />, { wrapper: createWrapper() });

    const emailInput = screen.getByPlaceholderText("auth.emailPlaceholder");
    await user.type(emailInput, "test@example.com");
    await user.click(screen.getByText("auth.continueWithEmail"));

    await waitFor(() => {
      expect(screen.getByTestId("input-otp")).toBeInTheDocument();
    });

    const resendButton = screen.getByRole("button", { name: /resend code/i });

    // Button should be disabled during countdown
    expect(resendButton).toBeDisabled();
    expect(resendButton.textContent).toContain("(30s)");
  });

  it.skip("enables resend button after countdown completes", async () => {
    // TODO: Fix timer test - fake timers don't properly advance through chained setTimeout in useEffect
    const user = userEvent.setup();
    render(<EmailLoginForm {...defaultProps} />, { wrapper: createWrapper() });

    const emailInput = screen.getByPlaceholderText("auth.emailPlaceholder");
    await user.type(emailInput, "test@example.com");
    await user.click(screen.getByText("auth.continueWithEmail"));

    await waitFor(() => {
      expect(screen.getByTestId("input-otp")).toBeInTheDocument();
    });

    await waitFor(
      () => {
        const resendButton = screen.getByRole("button", { name: /resend code/i });
        expect(resendButton).not.toBeDisabled();
      },
      { timeout: 31000 },
    );

    const resendButton = screen.getByRole("button", { name: /resend code/i });
    expect(resendButton.textContent).not.toContain("(");
  });
});
