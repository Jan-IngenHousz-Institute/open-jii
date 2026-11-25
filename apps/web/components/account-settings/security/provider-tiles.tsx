"use client";

import { ProviderMark } from "@/components/auth/provider-mark";
import { useLinkedAccounts } from "~/hooks/auth/useLinkedAccounts/useLinkedAccounts";
import { CONNECTABLE_PROVIDERS, PROVIDER_NAMES } from "~/lib/sign-in-providers";

import type { SignInMethods } from "@repo/auth/sign-in-methods";
import { useTranslation } from "@repo/i18n";

import { ConnectedAccountTile } from "./connected-account-tile";
import { MethodTile } from "./method-tile";
import { NotConnectedTile } from "./not-connected-tile";

export function ProviderTiles({ methods }: { methods: SignInMethods | undefined }) {
  const { t } = useTranslation("account");
  const { data: accounts, isError, isLoading } = useLinkedAccounts();

  if (isLoading || isError || !accounts) {
    const status = isError
      ? t("signInMethods.accountsUnavailable")
      : t("signInMethods.accountsLoading");
    return CONNECTABLE_PROVIDERS.map((provider) => (
      <MethodTile
        key={provider}
        icon={<ProviderMark id={provider} size={20} />}
        title={PROVIDER_NAMES[provider]}
        status={status}
      />
    ));
  }

  const connectedProviders = new Set(accounts.map((account) => account.providerId));

  return CONNECTABLE_PROVIDERS.flatMap((provider) => {
    const rows = accounts.filter((account) => account.providerId === provider);
    if (rows.length === 0) return [<NotConnectedTile key={provider} provider={provider} />];
    return rows.map((account) => (
      <ConnectedAccountTile
        key={account.id}
        account={account}
        provider={provider}
        methods={methods}
        connectedProviders={connectedProviders}
      />
    ));
  });
}
