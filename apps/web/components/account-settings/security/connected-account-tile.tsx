"use client";

import { ProviderMark } from "@/components/auth/provider-mark";
import { orcidRecordUrl } from "@/components/people/orcid-id";
import Link from "next/link";
import { profileLogin, useAccountInfo } from "~/hooks/auth/useAccountInfo/useAccountInfo";
import { CONNECTABLE_PROVIDERS, PROVIDER_NAMES } from "~/lib/sign-in-providers";
import type { ConnectableProvider } from "~/lib/sign-in-providers";

import { canRemoveSignInMethod } from "@repo/auth/sign-in-methods";
import type { SignInMethods } from "@repo/auth/sign-in-methods";
import { useTranslation } from "@repo/i18n";

import { DisconnectAccountDialog } from "./disconnect-account-dialog";
import { MethodTile } from "./method-tile";

interface LinkedAccount {
  id: string;
  providerId: string;
  accountId: string;
}

export function ConnectedAccountTile({
  account,
  provider,
  methods,
  connectedProviders,
}: {
  account: LinkedAccount;
  provider: ConnectableProvider;
  methods: SignInMethods | undefined;
  connectedProviders: Set<string>;
}) {
  const { t } = useTranslation("account");
  const info = useAccountInfo(account.id, provider === "github");
  const login = profileLogin(info.data?.data);

  const removable = methods
    ? canRemoveSignInMethod(methods, { kind: "account", accountId: account.id })
    : undefined;
  const otherProvider = CONNECTABLE_PROVIDERS.find((other) => other !== provider) ?? provider;
  const note =
    removable === false
      ? connectedProviders.has(otherProvider)
        ? t("signInMethods.onlyWayInAddPasskey")
        : t("signInMethods.onlyWayIn", { provider: PROVIDER_NAMES[otherProvider] })
      : undefined;

  const orcidUrl = orcidRecordUrl(account.accountId);
  const status =
    provider === "orcid" ? (
      <Link
        href={orcidUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2"
      >
        {orcidUrl}
      </Link>
    ) : login ? (
      t("signInMethods.githubConnectedAs", { login })
    ) : (
      t("signInMethods.githubConnected")
    );

  return (
    <MethodTile
      icon={<ProviderMark id={provider} size={20} />}
      title={PROVIDER_NAMES[provider]}
      status={status}
      note={note}
      action={
        <DisconnectAccountDialog
          accountId={account.id}
          provider={provider}
          label={provider === "orcid" ? account.accountId : login}
          disabled={removable !== true}
        />
      }
    />
  );
}
