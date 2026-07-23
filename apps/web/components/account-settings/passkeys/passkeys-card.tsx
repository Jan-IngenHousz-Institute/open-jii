"use client";

import type { LucideIcon } from "lucide-react";
import { CircleAlert, Fingerprint, Laptop, Loader2, Monitor, Smartphone, Usb } from "lucide-react";
import { usePasskeys } from "~/hooks/auth/usePasskeys/usePasskeys";
import { useWebAuthnSupport } from "~/hooks/auth/useWebAuthnSupport/useWebAuthnSupport";
import { useLocale } from "~/hooks/useLocale";
import { getAuthenticatorName } from "~/lib/authenticator-names";
import { formatShortDate } from "~/util/date";

import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";

import { CreatePasskeyButton } from "./create-passkey-button";
import { DeletePasskeyDialog } from "./delete-passkey-dialog";
import { RenamePasskeyDialog } from "./rename-passkey-dialog";

function providerIcon(provider: string | undefined): LucideIcon {
  if (!provider) return Fingerprint;
  if (provider.includes("iCloud") || provider.includes("Apple")) return Laptop;
  if (provider.includes("Google") || provider.includes("Samsung")) return Smartphone;
  if (provider.includes("Windows")) return Monitor;
  if (provider.includes("YubiKey")) return Usb;
  return Fingerprint;
}

export function PasskeysCard() {
  const { t } = useTranslation("account");
  const locale = useLocale();
  const { data: passkeys, isError, isFetching, isLoading, refetch } = usePasskeys();
  const webAuthnSupported = useWebAuthnSupport();

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle>{t("passkeys.title")}</CardTitle>
          <CardDescription>{t("passkeys.description")}</CardDescription>
        </div>
        {webAuthnSupported && <CreatePasskeyButton />}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2" data-testid="passkeys-loading">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : isError ? (
          <div
            className="text-muted-foreground flex flex-col items-center gap-3 py-8 text-sm"
            data-testid="passkeys-error"
          >
            <CircleAlert className="text-destructive h-8 w-8" />
            <p>{t("passkeys.loadError")}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              {isFetching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("passkeys.retry")}
            </Button>
          </div>
        ) : !passkeys || passkeys.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-sm">
            <Fingerprint className="h-8 w-8 opacity-50" />
            {t("passkeys.empty")}
          </div>
        ) : (
          <div className="divide-y rounded-lg border">
            {passkeys.map((passkey) => {
              const provider = getAuthenticatorName(passkey.aaguid);
              const displayName = passkey.name ?? provider ?? t("passkeys.unnamed");
              const Icon = providerIcon(provider);
              return (
                <div key={passkey.id} className="flex items-center gap-4 px-4 py-3.5">
                  <div className="bg-muted text-muted-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{displayName}</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {provider && provider !== displayName ? `${provider} · ` : ""}
                      {t("passkeys.added")} {formatShortDate(passkey.createdAt, locale)}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {passkey.backedUp ? t("passkeys.synced") : t("passkeys.deviceBound")}
                  </Badge>
                  <div className="flex items-center">
                    <RenamePasskeyDialog passkeyId={passkey.id} currentName={displayName} />
                    <DeletePasskeyDialog passkeyId={passkey.id} passkeyName={displayName} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
