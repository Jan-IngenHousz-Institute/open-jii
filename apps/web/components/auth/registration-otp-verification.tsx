"use client";

import { Pencil } from "lucide-react";
import React, { useState, useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useSignInEmail } from "~/hooks/auth/useSignInEmail/useSignInEmail";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { FormField, FormItem, FormControl, FormMessage } from "@repo/ui/components/form";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@repo/ui/components/input-otp";
import { toast } from "@repo/ui/hooks/use-toast";

import type { Registration } from "./registration-form";

const REGEXP_ONLY_DIGITS_PATTERN = "^[0-9]+$";
const RESEND_COOLDOWN_SECONDS = 30;

export function RegistrationOtpVerification({
  form,
  pendingEmail,
  isPending,
  setIsPending,
  onEditEmail,
  onComplete,
  OTP_LENGTH,
}: {
  form: UseFormReturn<Registration>;
  pendingEmail: string;
  isPending: boolean;
  setIsPending: React.Dispatch<React.SetStateAction<boolean>>;
  onEditEmail: () => void;
  onComplete: () => void;
  OTP_LENGTH: number;
}) {
  const { t } = useTranslation();
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN_SECONDS);
  const sendOtpVerification = useSignInEmail();

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  async function handleResendCode() {
    if (isPending || countdown > 0) return;

    setIsPending(true);
    try {
      const res = await sendOtpVerification.mutateAsync(pendingEmail);

      if (res.error) {
        toast({
          description: res.error.message,
        });
        return;
      }

      form.setValue("otp", "");
      setCountdown(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      console.error("Resend error:", error);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <h2 className="text-xl font-bold">{t("auth.checkEmail")}</h2>
      <div className="muted-foreground mb-4 text-sm">
        {t("auth.otpInstructions")}{" "}
        <Button
          type="button"
          variant="link"
          size="inline"
          className="font-medium"
          onClick={onEditEmail}
          aria-label="Edit email address"
        >
          {pendingEmail} <Pencil className="h-3 w-3" aria-hidden="true" />
        </Button>
      </div>
      <FormField
        control={form.control}
        name="otp"
        render={({ field, fieldState }) => (
          <FormItem>
            <FormControl>
              <InputOTP
                maxLength={OTP_LENGTH}
                pattern={REGEXP_ONLY_DIGITS_PATTERN}
                containerClassName="justify-center"
                onComplete={() => onComplete()}
                {...field}
              >
                <InputOTPGroup>
                  {Array.from({ length: OTP_LENGTH }, (_, index) => (
                    <InputOTPSlot key={index} index={index} aria-invalid={fieldState.invalid} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="pt-2">
        <Button
          type="button"
          variant="link"
          size="inline"
          className="text-sm font-medium"
          onClick={handleResendCode}
          disabled={countdown > 0 || isPending}
          aria-label={countdown > 0 ? `Resend code in ${countdown} seconds` : "Resend code"}
        >
          {countdown > 0 ? `${t("auth.resendCode")} (${countdown}s)` : t("auth.resendCode")}
        </Button>
      </div>
    </>
  );
}
