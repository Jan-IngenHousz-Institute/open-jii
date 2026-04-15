import { render, screen, userEvent } from "@/test/test-utils";
import type React from "react";
import { useForm } from "react-hook-form";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { Form } from "@repo/ui/components/form";
import type * as UIComponents from "@repo/ui/components/input-otp";

import type { Registration } from "./registration-form";
import { RegistrationOtpVerification } from "./registration-otp-verification";

// useSignInEmail — pragmatic mock (uses authClient, not ts-rest)
const mockSignInEmailMutate = vi.fn();
vi.mock("~/hooks/auth/useSignInEmail/useSignInEmail", () => ({
  useSignInEmail: () => ({
    mutateAsync: mockSignInEmailMutate,
  }),
}));

vi.mock("@repo/ui/components/input-otp", async () => {
  const actual = await vi.importActual("@repo/ui/components/input-otp");
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
      onChange?: (value: string) => void;
    }) => (
      <div data-testid="input-otp">
        <input
          type="text"
          aria-label="OTP input"
          value={value}
          onChange={(e) => {
            onChange?.(e.target.value);
            if (e.target.value.length === maxLength) {
              onComplete?.();
            }
          }}
          maxLength={maxLength}
        />
        {children}
      </div>
    ),
    InputOTPSlot: ({ index }: { index: number }) => <div data-testid={`otp-slot-${index}`} />,
  };
});

function Wrapper({
  pendingEmail = "user@example.com",
  isPending = false,
  onEditEmail = vi.fn(),
  onComplete = vi.fn(),
}: {
  pendingEmail?: string;
  isPending?: boolean;
  onEditEmail?: () => void;
  onComplete?: () => void;
}) {
  const form = useForm<Registration>({
    defaultValues: { otp: "" },
  });

  return (
    <Form {...form}>
      <form>
        <RegistrationOtpVerification
          form={form}
          pendingEmail={pendingEmail}
          isPending={isPending}
          setIsPending={vi.fn()}
          onEditEmail={onEditEmail}
          onComplete={onComplete}
          OTP_LENGTH={6}
        />
      </form>
    </Form>
  );
}

describe("RegistrationOtpVerification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders heading and instructions", () => {
    render(<Wrapper />);

    expect(screen.getByText("auth.checkEmail")).toBeInTheDocument();
    expect(screen.getByText("auth.otpInstructions")).toBeInTheDocument();
  });

  it("displays the pending email address", () => {
    render(<Wrapper pendingEmail="alice@example.com" />);

    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
  });

  it("calls onEditEmail when edit button is clicked", async () => {
    const user = userEvent.setup();
    const onEditEmail = vi.fn();
    render(<Wrapper onEditEmail={onEditEmail} />);

    await user.click(screen.getByRole("button", { name: /edit email/i }));

    expect(onEditEmail).toHaveBeenCalledTimes(1);
  });

  it("renders OTP input slots", () => {
    render(<Wrapper />);

    for (let i = 0; i < 6; i++) {
      expect(screen.getByTestId(`otp-slot-${i}`)).toBeInTheDocument();
    }
  });

  it("calls onComplete when 6 digits are entered", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<Wrapper onComplete={onComplete} />);

    const otpInput = screen.getByRole("textbox", { name: /otp input/i });
    await user.type(otpInput, "123456");

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("renders resend code button disabled initially (countdown active)", () => {
    render(<Wrapper />);

    const resendBtn = screen.getByRole("button", { name: /resend code in/i });
    expect(resendBtn).toBeDisabled();
  });

  it("disables resend button when isPending is true", () => {
    render(<Wrapper isPending={true} />);

    const resendBtn = screen.getByRole("button", { name: /resend code in/i });
    expect(resendBtn).toBeDisabled();
  });

  it("shows countdown seconds in resend button label", () => {
    render(<Wrapper />);

    // The button label includes seconds during cooldown
    const resendBtn = screen.getByRole("button", { name: /resend code in \d+ seconds/i });
    expect(resendBtn).toBeInTheDocument();
    expect(resendBtn).toBeDisabled();
  });
});
