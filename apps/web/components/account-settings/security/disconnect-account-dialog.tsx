"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useDisconnectAccount } from "~/hooks/auth/useDisconnectAccount/useDisconnectAccount";
import { PROVIDER_NAMES } from "~/lib/sign-in-providers";
import type { ConnectableProvider } from "~/lib/sign-in-providers";

import { useTranslation } from "@repo/i18n";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/ui/components/alert-dialog";
import { Button } from "@repo/ui/components/button";

export function DisconnectAccountDialog({
  accountId,
  provider,
  label,
  disabled,
}: {
  /** The `accounts` row id. */
  accountId: string;
  provider: ConnectableProvider;
  /** The GitHub username or the ORCID iD, when known. */
  label: string | undefined;
  disabled: boolean;
}) {
  const { t } = useTranslation("account");
  const [open, setOpen] = useState(false);
  const disconnect = useDisconnectAccount();
  const providerName = PROVIDER_NAMES[provider];

  const description =
    provider === "orcid"
      ? t("signInMethods.disconnectConfirmOrcid", { orcidId: label })
      : label
        ? t("signInMethods.disconnectConfirmGithub", { login: label })
        : t("signInMethods.disconnectConfirmGithubUnnamed");

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          {t("signInMethods.disconnect")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("signInMethods.disconnectTitle", { provider: providerName })}
          </AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("signInMethods.cancel")}</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={disconnect.isPending}
            onClick={() =>
              disconnect.mutate({ accountId, provider }, { onSuccess: () => setOpen(false) })
            }
          >
            {disconnect.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("signInMethods.disconnect")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
