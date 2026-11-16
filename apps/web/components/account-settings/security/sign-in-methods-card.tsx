"use client";

import { SettingsCard } from "@/components/shared/settings-card";
import { Fingerprint, Mail } from "lucide-react";
import { usePasskeys } from "~/hooks/auth/usePasskeys/usePasskeys";
import { useSignInMethods } from "~/hooks/auth/useSignInMethods/useSignInMethods";

import { useSession } from "@repo/auth/client";
import { hasUsableEmail } from "@repo/auth/sign-in-methods";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";

import { MethodTile } from "./method-tile";
import { ProviderTiles } from "./provider-tiles";

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
