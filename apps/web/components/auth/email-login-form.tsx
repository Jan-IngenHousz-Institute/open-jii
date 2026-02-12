"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useTranslation } from "@repo/i18n";
import {
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@repo/ui/components";

import { useSignInEmail } from "../../hooks/auth/useSignInEmail/useSignInEmail";
import { useVerifyEmail } from "../../hooks/auth/useVerifyEmail/useVerifyEmail";

const REGEXP_ONLY_DIGITS_PATTERN = "^[0-9]+$";
const RESEND_COOLDOWN_SECONDS = 30;
const OTP_LENGTH = 6;

interface EmailLoginFormProps {
  callbackUrl: string | undefined;
  locale: string;
  onShowOTPChange?: (showOTP: boolean) => void;
}

export function EmailLoginForm({ callbackUrl, locale, onShowOTPChange }: EmailLoginFormProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [showOTPInput, setShowOTPInput] = useState(false);
  const [email, setEmail] = useState("");
  const [countdown, setCountdown] = useState(0);

  const signInEmailMutation = useSignInEmail();
  const verifyEmailMutation = useVerifyEmail();
  const isPending = signInEmailMutation.isPending || verifyEmailMutation.isPending;

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const emailSchema = z.object({
    email: z.string().min(1, t("auth.emailRequired")).email(t("auth.emailInvalid")),
  });

  const errorMessage = t(
    "auth.otpError",
    "The code you entered is invalid or has expired. Please try again or request a new one.",
  );

  const otpSchema = z.object({
    code: z.string().length(OTP_LENGTH, errorMessage),
  });

  type EmailFormData = z.infer<typeof emailSchema>;
  type OTPFormData = z.infer<typeof otpSchema>;

  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const otpForm = useForm<OTPFormData>({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: "" },
  });

  async function handleEmailSubmit(data: EmailFormData) {
    if (isPending) return;

    try {
      const res = await signInEmailMutation.mutateAsync(data.email);
      if (res.error) {
        return;
      }

      setEmail(data.email);
      setShowOTPInput(true);
      onShowOTPChange?.(true);
      setCountdown(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      // Error handled by UI state
    }
  }

  async function handleOTPSubmit(data: OTPFormData) {
    if (isPending) return;

    try {
      const result = await verifyEmailMutation.mutateAsync({ email, code: data.code });

      if (result.error) {
        otpForm.setError("code", { message: errorMessage });
        return;
      }

      const user = result.data.user as { registered?: boolean } | undefined;
      const isRegistered = user?.registered;

      if (!isRegistered) {
        router.push(`/${locale}/register`);
      } else {
        router.push(callbackUrl ?? "/platform");
      }
    } catch (error: unknown) {
      otpForm.setError("code", { message: errorMessage });
    }
  }

  async function handleResendCode() {
    if (isPending || countdown > 0) return;

    try {
      await signInEmailMutation.mutateAsync(email);
      setCountdown(RESEND_COOLDOWN_SECONDS);
      otpForm.reset();
    } catch (error) {
      // Error handled by UI state
    }
  }

  function handleEditEmail() {
    setShowOTPInput(false);
    onShowOTPChange?.(false);
    otpForm.reset();
  }

  if (showOTPInput) {
    return (
      <Form {...otpForm}>
        <form onSubmit={otpForm.handleSubmit(handleOTPSubmit)} className="space-y-4">
          <h2 className="text-xl font-bold">
            {t("auth.checkEmail", "Check your email for a sign-in code")}
          </h2>
          <div className="muted-foreground mb-4 text-sm">
            {t("auth.otpInstructions", "Please enter the 6-digit code we sent to")}{" "}
            <button
              type="button"
              className="inline-flex items-center font-medium text-[#005e5e] hover:underline"
              onClick={handleEditEmail}
              aria-label="Edit email address"
            >
              {email} <Pencil className="ml-1 h-3 w-3" aria-hidden="true" />
            </button>
          </div>

          <FormField
            control={otpForm.control}
            name="code"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormControl>
                  <InputOTP
                    maxLength={OTP_LENGTH}
                    pattern={REGEXP_ONLY_DIGITS_PATTERN}
                    containerClassName="gap-2 justify-center"
                    onComplete={() => otpForm.handleSubmit(handleOTPSubmit)()}
                    {...field}
                  >
                    <InputOTPGroup className="gap-2">
                      {Array.from({ length: OTP_LENGTH }, (_, index) => (
                        <InputOTPSlot
                          key={index}
                          index={index}
                          className={`h-12 w-12 rounded-md border text-lg ${
                            fieldState.invalid ? "border-destructive" : ""
                          }`}
                        />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="pt-2">
            <button
              type="button"
              className="text-sm font-medium text-[#005e5e] hover:underline disabled:opacity-50"
              onClick={handleResendCode}
              disabled={countdown > 0 || isPending}
              aria-label={countdown > 0 ? `Resend code in ${countdown} seconds` : "Resend code"}
            >
              {countdown > 0
                ? `${t("auth.resendCode", "Re-send code")} (${countdown}s)`
                : t("auth.resendCode", "Re-send code")}
            </button>
          </div>
        </form>
      </Form>
    );
  }

  return (
    <Form {...emailForm}>
      <form onSubmit={emailForm.handleSubmit(handleEmailSubmit)} className="space-y-4">
        <FormField
          control={emailForm.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("auth.email")}</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder={t("auth.emailPlaceholder")}
                  disabled={isPending}
                  className="h-12 rounded-xl"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          variant="default"
          className="bg-primary text-primary-foreground hover:bg-primary-light active:bg-primary-dark mt-4 h-12 w-full rounded-xl"
          disabled={isPending || (!emailForm.formState.isValid && emailForm.formState.isDirty)}
        >
          {isPending ? (
            <>
              <Loader2 data-testid="loader" className="mr-2 h-4 w-4 animate-spin" />
              {t("auth.sendingEmail")}
            </>
          ) : (
            t("auth.continueWithEmail")
          )}
        </Button>
      </form>
    </Form>
  );
}
