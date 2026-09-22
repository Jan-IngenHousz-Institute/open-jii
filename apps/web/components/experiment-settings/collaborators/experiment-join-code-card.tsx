"use client";

import { useCreateExperimentJoinCode } from "@/hooks/experiment/join-code/useCreateExperimentJoinCode/useCreateExperimentJoinCode";
import { useExperimentJoinCode } from "@/hooks/experiment/join-code/useExperimentJoinCode/useExperimentJoinCode";
import { useRevokeExperimentJoinCode } from "@/hooks/experiment/join-code/useRevokeExperimentJoinCode/useRevokeExperimentJoinCode";
import { useLocale } from "@/hooks/useLocale";
import { formatShortDate } from "@/util/date";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import type { JoinCodeExpiry } from "@repo/api/domains/experiment/join-codes/experiment-join-codes.schema";
import { formatJoinCode } from "@repo/api/domains/experiment/join-codes/experiment-join-codes.schema";
import { useTranslation } from "@repo/i18n";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/components/alert-dialog";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Label } from "@repo/ui/components/label";
import { QrCode } from "@repo/ui/components/qr-code";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { toast } from "@repo/ui/hooks/use-toast";

/**
 * The landing page is always reached through the default locale: `[locale]/layout.tsx`
 * 404s every other locale while the language flag is off, and a QR printed for a
 * workshop has to keep working whatever the flag says that day.
 */
const LANDING_LOCALE = "en-US";

/**
 * `setTimeout` truncates to a signed 32-bit delay and fires at once past it, so a
 * deadline further out than this has to be reached in more than one hop.
 */
const MAX_TIMEOUT_MS = 2_147_483_647;

type PendingConfirmation = "regenerate" | "revoke";

interface ExperimentJoinCodeCardProps {
  experimentId: string;
}

export function ExperimentJoinCodeCard({ experimentId }: ExperimentJoinCodeCardProps) {
  const { t } = useTranslation();
  const locale = useLocale();

  const query = useExperimentJoinCode(experimentId);
  const { mutate: createJoinCode, isPending: isCreating } = useCreateExperimentJoinCode();
  const { mutate: revokeJoinCode, isPending: isRevoking } = useRevokeExperimentJoinCode();

  const [expiresIn, setExpiresIn] = useState<JoinCodeExpiry>("7d");
  const [confirming, setConfirming] = useState<PendingConfirmation | null>(null);
  const [origin, setOrigin] = useState("");
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => setOrigin(window.location.origin), []);

  const expiresAt = query.data?.joinCode?.expiresAt ?? null;

  // Every poll re-dates the clock, so a deadline that passes while a timer is
  // throttled or a response that arrives already expired both still read as expired.
  const clock = Math.max(tick, query.dataUpdatedAt);

  useEffect(() => {
    if (expiresAt === null) return;
    const deadline = new Date(expiresAt).getTime();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const arm = () => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        setTick(Date.now());
        return;
      }
      timer = setTimeout(arm, Math.min(remaining, MAX_TIMEOUT_MS));
    };

    arm();
    return () => clearTimeout(timer);
  }, [expiresAt]);

  const isMutating = isCreating || isRevoking;

  const expirySelect = (
    <div className="space-y-2">
      <Label htmlFor="join-code-expiry">{t("joinCode.expiresIn")}</Label>
      <Select
        value={expiresIn}
        onValueChange={(value) => setExpiresIn(value as JoinCodeExpiry)}
        disabled={isMutating}
      >
        <SelectTrigger id="join-code-expiry" className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="1d">{t("joinCode.expiry.1d")}</SelectItem>
          <SelectItem value="7d">{t("joinCode.expiry.7d")}</SelectItem>
          <SelectItem value="30d">{t("joinCode.expiry.30d")}</SelectItem>
          <SelectItem value="never">{t("joinCode.expiry.never")}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ description: t("joinCode.copied") });
    } catch {
      toast({ description: t("joinCode.copyFailed"), variant: "destructive" });
    }
  };

  const confirmPending = () => {
    if (confirming === "regenerate") {
      createJoinCode({ id: experimentId, expiresIn });
    } else if (confirming === "revoke") {
      revokeJoinCode({ id: experimentId });
    }
    setConfirming(null);
  };

  const shell = (children: ReactNode, description?: ReactNode) => (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("joinCode.title")}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );

  if (query.isPending) {
    return shell(<p className="text-muted-foreground text-sm">{t("joinCode.loading")}</p>);
  }

  // A failed read must never fall through to the create form: telling an organizer
  // "no code yet" invites them to mint a second one over a code that already exists.
  if (query.isError) {
    return shell(
      <div className="space-y-3">
        <p className="text-destructive text-sm">{t("joinCode.loadFailed")}</p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          {t("joinCode.retry")}
        </Button>
      </div>,
    );
  }

  const introSuffix = ` ${t("joinCode.workbookHint")}`;
  const joinCode = query.data.joinCode;

  if (joinCode === null) {
    return shell(
      <div className="space-y-4">
        {expirySelect}
        <Button
          onClick={() => createJoinCode({ id: experimentId, expiresIn })}
          isLoading={isCreating}
        >
          {t("joinCode.create")}
        </Button>
      </div>,
      `${t("joinCode.introEmpty")}${introSuffix}`,
    );
  }

  const formattedCode = formatJoinCode(joinCode.code);
  const landingUrl = `${origin}/${LANDING_LOCALE}/join/${formattedCode}`;
  const qrLabel = t("joinCode.qrLabel");
  const expiresAtValue = joinCode.expiresAt;

  if (expiresAtValue !== null && new Date(expiresAtValue).getTime() <= clock) {
    return shell(
      <div className="space-y-4">
        <p className="bg-status-stale text-status-stale-foreground rounded-md px-3 py-2 text-sm">
          {t("joinCode.expiredBanner", {
            code: formattedCode,
            date: formatShortDate(expiresAtValue, locale),
          })}
        </p>
        {expirySelect}
        <Button
          onClick={() => createJoinCode({ id: experimentId, expiresIn })}
          isLoading={isCreating}
        >
          {t("joinCode.createAgain")}
        </Button>
      </div>,
    );
  }

  return (
    <>
      {shell(
        <div className="flex flex-wrap items-start gap-6">
          <div className="min-w-64 flex-1 space-y-2">
            <p className="font-mono text-3xl tracking-widest">{formattedCode}</p>
            <p className="text-muted-foreground text-sm">
              {expiresAtValue === null
                ? t("joinCode.neverExpires")
                : t("joinCode.expiresOn", { date: formatShortDate(expiresAtValue, locale) })}
              {" · "}
              {t("joinCode.redeemed", { joined: joinCode.redemptionCount })}
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" onClick={() => void copy(formattedCode)}>
                {t("joinCode.copyCode")}
              </Button>
              <Button variant="outline" onClick={() => void copy(landingUrl)}>
                {t("joinCode.copyLink")}
              </Button>
              <Button
                variant="outline"
                disabled={isMutating}
                onClick={() => setConfirming("regenerate")}
              >
                {t("joinCode.regenerate")}
              </Button>
              <Button
                variant="destructive"
                disabled={isMutating}
                onClick={() => setConfirming("revoke")}
              >
                {t("joinCode.revoke")}
              </Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-md border" role="img" aria-label={qrLabel}>
            <QrCode value={landingUrl} size={132} />
          </div>
        </div>,
        `${t("joinCode.introActive")}${introSuffix}`,
      )}

      <AlertDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("joinCode.confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("joinCode.confirmBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                confirmPending();
              }}
            >
              {confirming === "revoke" ? t("joinCode.revoke") : t("joinCode.regenerate")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
