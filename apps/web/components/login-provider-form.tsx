"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { authClient } from "@repo/auth/client";
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

import { useSignInEmail, useVerifyEmail } from "../hooks/useAuth";

export function LoginProviderForm({
  provider,
  callbackUrl,
  layoutCount,
  locale,
  onShowOTPChange,
}: {
  provider: { id: string; name: string };
  callbackUrl: string | undefined;
  layoutCount?: number;
  locale: string;
  onShowOTPChange?: (showOTP: boolean) => void;
}) {
  const isEmailProvider = provider.id === "email";

  if (isEmailProvider) {
    return (
      <EmailLoginForm callbackUrl={callbackUrl} locale={locale} onShowOTPChange={onShowOTPChange} />
    );
  }

  return <OAuthLoginForm provider={provider} callbackUrl={callbackUrl} layoutCount={layoutCount} />;
}

function EmailLoginForm({
  callbackUrl,
  locale,
  onShowOTPChange,
}: {
  callbackUrl: string | undefined;
  locale: string;
  onShowOTPChange?: (showOTP: boolean) => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [showOTPInput, setShowOTPInput] = useState(false);
  const [email, setEmail] = useState("");
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const signInEmailMutation = useSignInEmail();
  const verifyEmailMutation = useVerifyEmail();
  const isPending = signInEmailMutation.isPending || verifyEmailMutation.isPending;

  const emailSchema = z.object({
    email: z.string().min(1, t("auth.emailRequired")).email(t("auth.emailInvalid")),
  });

  const otpSchema = z.object({
    code: z.string().min(6, "Code must be 6 digits").max(6, "Code must be 6 digits"),
  });

  type EmailFormData = z.infer<typeof emailSchema>;
  type OTPFormData = z.infer<typeof otpSchema>;

  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      email: "",
    },
  });

  const otpForm = useForm<OTPFormData>({
    resolver: zodResolver(otpSchema),
    defaultValues: {
      code: "",
    },
  });

  async function onEmailSubmit(data: EmailFormData) {
    if (isPending) return;
    try {
      const res = await signInEmailMutation.mutateAsync(data.email);
      if (res.error) {
        console.error("Email send error:", res.error);
        return;
      }
      setEmail(data.email);
      setShowOTPInput(true);
      onShowOTPChange?.(true);
      setCountdown(30);
    } catch (error) {
      console.error("Email send error:", error);
    }
  }

  async function onOTPSubmit(data: OTPFormData) {
    if (isPending) return;
    try {
      const result = await verifyEmailMutation.mutateAsync({ email, code: data.code });

      if (result.error) {
        otpForm.setError("code", { message: result.error.message ?? "Invalid code" });
        return;
      }

      // Cast to specific type to avoid ESLint unsafe assignment error
      const user = result.data.user as { registered?: boolean } | undefined;
      const isRegistered = user?.registered;

      if (!isRegistered) {
        router.push(`/${locale}/register`);
      } else {
        router.push(callbackUrl ?? "/platform");
      }
    } catch (error: unknown) {
      console.error("OTP verification error:", error);
      otpForm.setError("code", { message: "Invalid code" });
    }
  }

  if (showOTPInput) {
    return (
      <Form {...otpForm}>
        <form onSubmit={otpForm.handleSubmit(onOTPSubmit)} className="space-y-4">
          <h2 className="text-xl font-bold">
            {t("auth.checkEmail", "Check your email for a sign-in code")}
          </h2>
          <div className="muted-foreground mb-4 text-sm">
            Please enter the 6-digit code we sent to <br />
            <button
              type="button"
              className="inline-flex items-center font-medium text-[#005e5e] hover:underline"
              onClick={() => {
                setShowOTPInput(false);
                onShowOTPChange?.(false);
              }}
            >
              {email} <Pencil className="ml-1 h-3 w-3" />
            </button>
          </div>
          <FormField
            control={otpForm.control}
            name="code"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormControl>
                  <InputOTP
                    maxLength={6}
                    containerClassName="gap-2"
                    onComplete={() => otpForm.handleSubmit(onOTPSubmit)()}
                    {...field}
                  >
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <InputOTPGroup key={index}>
                        <InputOTPSlot
                          index={index}
                          className={`h-12 w-12 rounded-md border text-lg ${
                            fieldState.invalid ? "border-destructive" : ""
                          }`}
                        />
                      </InputOTPGroup>
                    ))}
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
              onClick={async () => {
                if (isPending || countdown > 0) return;
                try {
                  await signInEmailMutation.mutateAsync(email);
                  setCountdown(30);
                } catch (error) {
                  console.error("Resend error:", error);
                }
              }}
              disabled={countdown > 0 || isPending}
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
      <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
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
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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

function OAuthLoginForm({
  provider,
  callbackUrl,
  layoutCount,
}: {
  provider: { id: string; name: string };
  callbackUrl: string | undefined;
  layoutCount?: number;
}) {
  const { t } = useTranslation();
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    const redirectUrl = callbackUrl ?? "/platform";

    await authClient.signIn.social({
      provider: provider.id as "github" | "orcid",
      callbackURL: redirectUrl,
    });
  };

  const providerName = provider.id.charAt(0).toUpperCase() + provider.id.slice(1);

  return (
    <form onSubmit={handleSubmit}>
      <Button
        type="submit"
        variant="outline"
        className="bg-surface text-foreground hover:bg-surface-light active:bg-surface-dark flex h-12 w-full items-center justify-center rounded-full"
        disabled={isPending}
      >
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}

        {layoutCount === 2 && (
          <>
            <ProviderImage id={provider.id} />
            <span className="font-notosans md:hidden">{`${t("auth.continueWith")} ${providerName}`}</span>
            <span className="font-notosans hidden md:inline">{providerName}</span>
          </>
        )}

        {layoutCount === 3 && (
          <>
            <span className="font-notosans flex items-center md:hidden">
              <span className="mr-2">
                <ProviderImage id={provider.id} />
              </span>
              {`${t("auth.continueWith")} ${providerName}`}
            </span>
            <span className="hidden w-full items-center justify-center md:flex">
              <ProviderImage id={provider.id} />
            </span>
          </>
        )}

        {layoutCount !== 2 && layoutCount !== 3 && (
          <>
            <ProviderImage id={provider.id} />
            <span className="font-notosans">{t(`auth.loginWith-${provider.id}`)}</span>
          </>
        )}
      </Button>
    </form>
  );
}

function ProviderImage({ id }: { id: string }) {
  switch (id) {
    case "github":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          style={{ width: 24, height: 24 }}
        >
          <path
            d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
            fill="currentColor"
          />
        </svg>
      );
    case "orcid":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          style={{ width: 24, height: 24 }}
        >
          <path
            d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zM7.369 4.378c.525 0 .947.431.947.947 0 .525-.422.947-.947.947A.943.943 0 0 1 6.422 5.325c0-.516.422-.947.947-.947zm-.722 3.038h1.444v10.041H6.647V7.416zm3.562 0h3.9c3.712 0 5.344 2.653 5.344 5.025 0 2.578-2.016 5.016-5.325 5.016h-3.919V7.416zm1.444 1.303v7.444h2.297c2.359 0 3.588-1.313 3.588-3.722 0-2.2-1.313-3.722-3.588-3.722h-2.297z"
            fill="#A6CE39"
          />
        </svg>
      );
  }
  return null;
}
