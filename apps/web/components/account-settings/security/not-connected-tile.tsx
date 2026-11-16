"use client";

import { ProviderMark } from "@/components/auth/provider-mark";
import { Loader2 } from "lucide-react";
import { useConnectAccount } from "~/hooks/auth/useConnectAccount/useConnectAccount";
import { PROVIDER_NAMES } from "~/lib/sign-in-providers";
import type { ConnectableProvider } from "~/lib/sign-in-providers";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

import { MethodTile } from "./method-tile";

export function NotConnectedTile({ provider }: { provider: ConnectableProvider }) {
  const { t } = useTranslation("account");
  const connect = useConnectAccount();
  // On success the browser is already leaving for the provider.
  const starting = connect.isPending || connect.isSuccess;

  return (
    <MethodTile
      icon={<ProviderMark id={provider} size={20} />}
      title={PROVIDER_NAMES[provider]}
      status={
        provider === "orcid"
          ? t("signInMethods.orcidNotConnected")
          : t("signInMethods.notConnected")
      }
      action={
        <Button
          variant="outline"
          size="sm"
          disabled={starting}
          onClick={() => connect.mutate(provider)}
        >
          {starting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("signInMethods.connect")}
        </Button>
      }
    />
  );
}
