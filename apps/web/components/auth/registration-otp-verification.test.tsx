import { act, fireEvent, render, screen, userEvent } from "@/test/test-utils";
import type React from "react";
import { useForm } from "react-hook-form";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { authClient } from "@repo/auth/client";
import { Form } from "@repo/ui/components/form";
import { toast } from "@repo/ui/hooks/use-toast";

import type { Registration } from "./registration-form";
import { RegistrationOtpVerification } from "./registration-otp-verification";

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

  describe("resending the code", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    function waitOutCooldown() {
      for (let second = 0; second < 30; second++) {
        act(() => {
          vi.advanceTimersByTime(1000);
        });
      }
    }

    async function resend() {
      waitOutCooldown();
      fireEvent.click(screen.getByRole("button", { name: "Resend code" }));
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });
    }

    it("asks for a new code for the pending address, never a sign-in code", async () => {
      render(<Wrapper pendingEmail="carol@uni.edu" />);

      await resend();

      expect(authClient.emailOtp.requestEmailChange).toHaveBeenCalledWith({
        newEmail: "carol@uni.edu",
      });
      expect(authClient.emailOtp.sendVerificationOtp).not.toHaveBeenCalled();
    });

    it("starts the cooldown again after a resend", async () => {
      render(<Wrapper pendingEmail="carol@uni.edu" />);

      await resend();

      expect(screen.getByRole("button", { name: /resend code in \d+ seconds/i })).toBeDisabled();
    });

    it("shows the server's refusal", async () => {
      vi.mocked(authClient.emailOtp.requestEmailChange).mockResolvedValue({
        data: null,
        error: { message: "Too many requests", status: 429, statusText: "Too Many Requests" },
      });
      render(<Wrapper pendingEmail="carol@uni.edu" />);

      await resend();

      expect(toast).toHaveBeenCalledWith({ description: "Too many requests" });
    });
  });
});
