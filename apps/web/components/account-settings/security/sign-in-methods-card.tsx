"use client";

import { ProviderMark } from "@/components/auth/provider-mark";
import { SettingsCard } from "@/components/shared/settings-card";
import { Fingerprint, Loader2, Mail } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { profileLogin, useAccountInfo } from "~/hooks/auth/useAccountInfo/useAccountInfo";
import { useConnectAccount } from "~/hooks/auth/useConnectAccount/useConnectAccount";
import { useLinkedAccounts } from "~/hooks/auth/useLinkedAccounts/useLinkedAccounts";
import { usePasskeys } from "~/hooks/auth/usePasskeys/usePasskeys";
import { useSignInMethods } from "~/hooks/auth/useSignInMethods/useSignInMethods";
import { CONNECTABLE_PROVIDERS, PROVIDER_NAMES } from "~/lib/sign-in-providers";
import type { ConnectableProvider } from "~/lib/sign-in-providers";

import { useSession } from "@repo/auth/client";
import { canRemoveSignInMethod, hasUsableEmail } from "@repo/auth/sign-in-methods";
import type { SignInMethods } from "@repo/auth/sign-in-methods";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";

import { DisconnectAccountDialog } from "./disconnect-account-dialog";

interface LinkedAccount {
  id: string;
  providerId: string;
  accountId: string;
}

function MethodTile({
  icon,
  iconTone = "muted",
  title,
  status,
  action,
  note,
}: {
  icon: ReactNode;
  iconTone?: "muted" | "secondary";
  title: string;
  status: ReactNode;
  action?: ReactNode;
  note?: string;
}) {
  return (
    <div className="rounded-lg border p-3.5">
      <div className="flex items-center gap-3">
        <div
          className={
            iconTone === "secondary"
              ? "bg-secondary text-secondary-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              : "bg-muted text-muted-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          }
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-muted-foreground wrap-anywhere text-xs">{status}</p>
        </div>
        {action}
      </div>
      {note && <p className="text-muted-foreground pl-13 mt-2.5 text-xs">{note}</p>}
    </div>
  );
}

function ConnectedAccountTile({
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

  const orcidUrl = `https://orcid.org/${account.accountId}`;
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

function NotConnectedTile({ provider }: { provider: ConnectableProvider }) {
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

function ProviderTiles({ methods }: { methods: SignInMethods | undefined }) {
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

export function SignInMethodsCard() {
  const { t } = useTranslation("account");
  const { data: session } = useSession();
  const { data: passkeys, isError, isLoading } = usePasskeys();
  const methods = useSignInMethods();
  const passkeyCount = passkeys?.length ?? 0;

  const passkeyStatus = isLoading
    ? t("signInMethods.passkeysLoading")
    : isError
      ? t("signInMethods.passkeysUnavailable")
      : passkeyCount > 0
        ? t("signInMethods.passkeysCount", { count: passkeyCount })
        : t("signInMethods.passkeysNone");

  const emailUsable = session
    ? hasUsableEmail(session.user.email, session.user.emailVerified)
    : undefined;

  return (
    <SettingsCard
      title={t("signInMethods.title")}
      description={t("signInMethods.description")}
      contentClassName="grid gap-3 sm:grid-cols-2"
    >
      <MethodTile
        icon={<Mail className="h-5 w-5" />}
        title={t("signInMethods.emailTitle")}
        status={
          emailUsable === undefined
            ? null
            : emailUsable
              ? t("signInMethods.emailUsable", { email: session?.user.email })
              : t("signInMethods.emailUnusable")
        }
        action={emailUsable && <Badge variant="secondary">{t("signInMethods.emailBadge")}</Badge>}
      />
      <MethodTile
        icon={<Fingerprint className="h-5 w-5" />}
        iconTone="secondary"
        title={t("signInMethods.passkeysTitle")}
        status={t("signInMethods.passkeysDescription")}
        action={<Badge variant="secondary">{passkeyStatus}</Badge>}
      />
      <ProviderTiles methods={methods} />
    </SettingsCard>
  );
}
