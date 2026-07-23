"use client";

import { Fingerprint, Mail } from "lucide-react";
import { usePasskeys } from "~/hooks/auth/usePasskeys/usePasskeys";

import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

export function SignInMethodsCard() {
  const { t } = useTranslation("account");
  const { data: passkeys, isError, isLoading } = usePasskeys();
  const passkeyCount = passkeys?.length ?? 0;

  const passkeyStatus = isLoading
    ? t("signInMethods.passkeysLoading")
    : isError
      ? t("signInMethods.passkeysUnavailable")
      : passkeyCount > 0
        ? t("signInMethods.passkeysCount", { count: passkeyCount })
        : t("signInMethods.passkeysNone");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("signInMethods.title")}</CardTitle>
        <CardDescription>{t("signInMethods.description")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-lg border p-3.5">
          <div className="bg-muted text-muted-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
            <Mail className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{t("signInMethods.emailTitle")}</p>
            <p className="text-muted-foreground text-xs">{t("signInMethods.emailDescription")}</p>
          </div>
          <Badge variant="secondary">{t("signInMethods.emailBadge")}</Badge>
        </div>
        <div className="flex items-center gap-3 rounded-lg border p-3.5">
          <div className="bg-secondary text-secondary-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
            <Fingerprint className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{t("signInMethods.passkeysTitle")}</p>
            <p className="text-muted-foreground text-xs">
              {t("signInMethods.passkeysDescription")}
            </p>
          </div>
          <Badge variant="secondary">{passkeyStatus}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
