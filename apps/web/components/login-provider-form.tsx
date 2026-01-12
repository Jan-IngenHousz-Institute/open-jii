"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { env } from "~/env";

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
} from "@repo/ui/components";

import { signInWithEmail } from "../app/actions/auth";

export function LoginProviderForm({
  provider,
  callbackUrl,
  layoutCount,
}: {
  provider: { id: string; name: string };
  callbackUrl: string | undefined;
  layoutCount?: number;
}) {
  const isEmailProvider = provider.id === "email";

  if (isEmailProvider) {
    return <EmailLoginForm callbackUrl={callbackUrl} />;
  }

  return <OAuthLoginForm provider={provider} callbackUrl={callbackUrl} layoutCount={layoutCount} />;
}

function EmailLoginForm({ callbackUrl }: { callbackUrl: string | undefined }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [showOTPInput, setShowOTPInput] = useState(false);
  const [email, setEmail] = useState("");

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
    setIsPending(true);
    try {
      await signInWithEmail(data.email);
      setEmail(data.email);
      setShowOTPInput(true);
    } catch (error) {
      console.error("Email send error:", error);
    } finally {
      setIsPending(false);
    }
  }

  async function onOTPSubmit(data: OTPFormData) {
    if (isPending) return;
    setIsPending(true);
    try {
      const { verifyEmailCode } = await import("../app/actions/auth");
      await verifyEmailCode(email, data.code);
      // Redirect to callback or platform
      router.push(callbackUrl ?? "/platform");
    } catch (error) {
      console.error("OTP verification error:", error);
      otpForm.setError("code", { message: "Invalid code" });
    } finally {
      setIsPending(false);
    }
  }

  if (showOTPInput) {
    return (
      <Form {...otpForm}>
        <form onSubmit={otpForm.handleSubmit(onOTPSubmit)} className="space-y-4">
          <p className="muted-foreground mb-4 text-sm">
            {t("auth.otpSentTo", {
              email: email.length > 30 ? `${email.slice(0, 30)}...` : email,
            })}
          </p>
          <FormField
            control={otpForm.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("auth.verificationCode")}</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    placeholder="000000"
                    disabled={isPending}
                    className="h-12 rounded-xl"
                    maxLength={6}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-12 flex-1 rounded-xl"
              onClick={() => setShowOTPInput(false)}
              disabled={isPending}
            >
              {t("auth.back")}
            </Button>
            <Button
              type="submit"
              variant="default"
              className="bg-primary text-primary-foreground hover:bg-primary-light active:bg-primary-dark h-12 flex-1 rounded-xl"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("auth.verifying")}
                </>
              ) : (
                t("auth.verify")
              )}
            </Button>
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    const redirectUrl = callbackUrl ?? "/platform";
    const authUrl = `${env.NEXT_PUBLIC_API_URL}/auth/${provider.id}?callbackUrl=${encodeURIComponent(redirectUrl)}`;
    window.location.href = authUrl;
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
