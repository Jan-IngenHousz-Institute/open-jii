"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { useTranslation } from "@repo/i18n";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  ScrollArea,
} from "@repo/ui/components";
import { cva } from "@repo/ui/lib/utils";

import { EmailLoginForm } from "./email-login-form";
import { OAuthLoginForm } from "./oauth-login-form";

/**
 * Provider map for displaying available auth providers
 */
const providerMap = [
  { id: "github", name: "GitHub" },
  { id: "orcid", name: "ORCID" },
  { id: "email", name: "Email" },
];

const providerGridVariants = cva("mb-6 grid w-full grid-cols-1 gap-3", {
  variants: {
    count: {
      1: "",
      2: "md:grid-cols-2",
      3: "md:grid-cols-3",
      many: "md:grid-cols-1",
    },
  },
  defaultVariants: {
    count: 1,
  },
});

function ProviderGrid({
  providers,
  callbackUrl,
}: {
  providers: { id: string; name: string }[];
  callbackUrl: string | undefined;
}) {
  const count = providers.length;
  const variant = count === 2 ? 2 : count === 3 ? 3 : count > 3 ? "many" : 1;

  return (
    <div className={providerGridVariants({ count: variant })}>
      {providers.map((provider) => (
        <OAuthLoginForm
          key={provider.id}
          provider={provider}
          callbackUrl={callbackUrl}
          layoutCount={count}
        />
      ))}
    </div>
  );
}

interface LoginFormProps {
  callbackUrl?: string;
  locale: string;
  termsData: {
    title: ReactNode;
    content: ReactNode;
  };
}

export function LoginForm({ callbackUrl, locale, termsData }: LoginFormProps) {
  const { t } = useTranslation();
  const [showOTP, setShowOTP] = useState(false);

  const emailProvider = providerMap.find((p) => p.id === "email");
  const oauthProviders = providerMap.filter((p) => p.id !== "email");

  return (
    <div className="bg-card text-card-foreground ring-border flex min-h-[600px] w-full flex-col rounded-2xl p-8 shadow-lg ring-1 md:p-14">
      {/* Beta notice badge - hide when OTP shown */}
      {!showOTP && (
        <div className="bg-badge-featured border-badge-featured/40 mb-6 rounded-md border px-3 py-2 text-xs sm:text-sm">
          openJII is still under development and currently supports only a small group of beta test
          users.
        </div>
      )}

      {/* Title - hide when OTP shown because OTP view has its own title */}
      {!showOTP && (
        <h1 className="mb-4 text-left text-2xl font-bold">{t("auth.loginToAccount")}</h1>
      )}

      {/* Email provider */}
      {emailProvider && (
        <EmailLoginForm callbackUrl={callbackUrl} locale={locale} onShowOTPChange={setShowOTP} />
      )}

      {/* Divider */}
      {!showOTP && oauthProviders.length > 0 && (
        <div className="my-8 flex items-center">
          <div className="border-surface flex-1 border-t" />
          <span className="bg-card text-muted-foreground mx-2 px-2 text-sm">{t("auth.or")}</span>
          <div className="border-surface flex-1 border-t" />
        </div>
      )}

      {/* OAuth providers */}
      {!showOTP && <ProviderGrid providers={oauthProviders} callbackUrl={callbackUrl} />}

      <div className="flex-1" />

      {/* Terms */}
      {!showOTP && (
        <p className="text-accent-foreground text-left text-xs">
          {t("auth.continueTermsPrefix")}{" "}
          <Dialog>
            <DialogTrigger asChild>
              <button type="button" className="cursor-pointer underline">
                {t("auth.terms")}
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{termsData.title}</DialogTitle>
              </DialogHeader>
              <ScrollArea className="h-64 w-full rounded-md border p-4">
                {termsData.content}
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </p>
      )}
    </div>
  );
}
