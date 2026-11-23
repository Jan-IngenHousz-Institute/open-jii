"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { env } from "~/env";
import { getAuthCallback } from "~/lib/auth-callback";

import { authClient } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

import { LastUsedBadge } from "./last-used-badge";
import { ProviderMark } from "./provider-mark";

interface OAuthLoginFormProps {
  provider: { id: string; name: string };
  callbackUrl: string | undefined;
  locale: string;
  layoutCount?: number;
  isLastUsed?: boolean;
}

export function OAuthLoginForm({
  provider,
  locale,
  callbackUrl,
  layoutCount,
  isLastUsed,
}: OAuthLoginFormProps) {
  const { t } = useTranslation();
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsPending(true);
    const destination = getAuthCallback(callbackUrl);
    const callback = new URL(destination, env.NEXT_PUBLIC_BASE_URL);
    const redirectUrl =
      callback.origin === new URL(env.NEXT_PUBLIC_BASE_URL).origin
        ? callback.href
        : new URL(
            `/${locale}/register?callbackUrl=${encodeURIComponent(destination)}`,
            env.NEXT_PUBLIC_BASE_URL,
          ).href;

    const errorURL = `${env.NEXT_PUBLIC_BASE_URL}/login-error`;

    await authClient.signIn.social({
      provider: provider.id,
      callbackURL: redirectUrl,
      errorCallbackURL: errorURL,
    });
  }

  const providerName = provider.id.charAt(0).toUpperCase() + provider.id.slice(1);

  return (
    <form onSubmit={handleSubmit} className="relative">
      <Button
        type="submit"
        variant="outline"
        className="flex w-full items-center justify-center"
        disabled={isPending}
      >
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        <ProviderButtonContent
          providerId={provider.id}
          providerName={providerName}
          layoutCount={layoutCount}
          continueWith={t("auth.continueWith")}
          loginWithKey={`auth.loginWith-${provider.id}`}
        />
      </Button>
      {isLastUsed && <LastUsedBadge />}
    </form>
  );
}

function ProviderButtonContent({
  providerId,
  providerName,
  layoutCount,
  continueWith,
  loginWithKey,
}: {
  providerId: string;
  providerName: string;
  layoutCount?: number;
  continueWith: string;
  loginWithKey: string;
}) {
  const { t } = useTranslation();

  if (layoutCount === 2) {
    return (
      <>
        <ProviderMark id={providerId} />
        <span className="md:hidden">{`${continueWith} ${providerName}`}</span>
        <span className="hidden md:inline">{providerName}</span>
      </>
    );
  }

  if (layoutCount === 3) {
    return (
      <>
        <span className="flex items-center md:hidden">
          <span className="mr-2">
            <ProviderMark id={providerId} />
          </span>
          {`${continueWith} ${providerName}`}
        </span>
        <span className="hidden w-full items-center justify-center md:flex">
          <ProviderMark id={providerId} />
        </span>
      </>
    );
  }

  return (
    <>
      <ProviderMark id={providerId} />
      <span>{t(loginWithKey)}</span>
    </>
  );
}
