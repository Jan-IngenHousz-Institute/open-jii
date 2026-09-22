"use client";

import { useCreateExperimentJoinCode } from "@/hooks/experiment/join-code/useCreateExperimentJoinCode/useCreateExperimentJoinCode";
import { useExperimentJoinCode } from "@/hooks/experiment/join-code/useExperimentJoinCode/useExperimentJoinCode";
import { useRevokeExperimentJoinCode } from "@/hooks/experiment/join-code/useRevokeExperimentJoinCode/useRevokeExperimentJoinCode";
import { useLocale } from "@/hooks/useLocale";
import { formatShortDate } from "@/util/date";
import { KeyRound } from "lucide-react";
import { useEffect, useState } from "react";

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
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
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

/** Large enough to scan from the back of a room off a projector. */
const DIALOG_QR_SIZE = 256;

type PendingConfirmation = "regenerate" | "revoke";

/**
 * Whether the deadline has passed, re-rendering when it does. `dataUpdatedAt` keeps
 * the comparison against a clock the last response dated, so a deadline crossed
 * while a timer was throttled still reads as expired.
 */
function useJoinCodeExpired(expiresAt: string | null, dataUpdatedAt: number): boolean {
  const [tick, setTick] = useState(() => Date.now());

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

  if (expiresAt === null) return false;
  return new Date(expiresAt).getTime() <= Math.max(tick, dataUpdatedAt);
}

interface ExperimentJoinCodeButtonProps {
  experimentId: string;
}

/**
 * Opens the join-code dialog and carries the redemption count while a code is live.
 * Reads the code without polling: only the open dialog has a reason to keep asking.
 */
export function ExperimentJoinCodeButton({ experimentId }: ExperimentJoinCodeButtonProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const query = useExperimentJoinCode(experimentId);
  const joinCode = query.data?.joinCode ?? null;
  const isExpired = useJoinCodeExpired(joinCode?.expiresAt ?? null, query.dataUpdatedAt);
  const activeCode = joinCode !== null && !isExpired ? joinCode : null;

  return (
    <>
      <Button variant="outline" onClick={() => setIsOpen(true)}>
        <KeyRound className="h-4 w-4" />
        {t("joinCode.title")}
        {activeCode !== null && (
          // Labelled so the button announces "Join code, N joined" rather than a
          // bare number, while the badge itself stays as compact as the count.
          <Badge
            variant="secondary"
            aria-label={t("joinCode.redeemed", { joined: activeCode.redemptionCount })}
          >
            {activeCode.redemptionCount}
          </Badge>
        )}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-2xl">
          {/* Radix unmounts closed content, so the body — and with it the poll —
              exists only while the dialog is open. */}
          <JoinCodeDialogBody experimentId={experimentId} />
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Mounted only while the dialog is open, which is what scopes the poll to the
 * surface that displays the counter.
 */
function JoinCodeDialogBody({ experimentId }: { experimentId: string }) {
  const { t } = useTranslation();
  const locale = useLocale();

  const query = useExperimentJoinCode(experimentId, { poll: true });
  const { mutate: createJoinCode, isPending: isCreating } = useCreateExperimentJoinCode();
  const { mutate: revokeJoinCode, isPending: isRevoking } = useRevokeExperimentJoinCode();

  const [expiresIn, setExpiresIn] = useState<JoinCodeExpiry>("7d");
  const [confirming, setConfirming] = useState<PendingConfirmation | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

  const joinCode = query.data?.joinCode ?? null;
  const isExpired = useJoinCodeExpired(joinCode?.expiresAt ?? null, query.dataUpdatedAt);

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

  const header = (description?: string) => (
    <DialogHeader>
      <DialogTitle>{t("joinCode.title")}</DialogTitle>
      {description !== undefined ? <DialogDescription>{description}</DialogDescription> : null}
    </DialogHeader>
  );

  if (query.isPending) {
    return (
      <>
        {header()}
        <p className="text-muted-foreground text-sm">{t("joinCode.loading")}</p>
      </>
    );
  }

  // A failed read must never fall through to the create form: telling an organizer
  // "no code yet" invites them to mint a second one over a code that already exists.
  if (query.isError) {
    return (
      <>
        {header()}
        <div className="space-y-3">
          <p className="text-destructive text-sm">{t("joinCode.loadFailed")}</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            {t("joinCode.retry")}
          </Button>
        </div>
      </>
    );
  }

  const introSuffix = ` ${t("joinCode.workbookHint")}`;

  if (joinCode === null) {
    return (
      <>
        {header(`${t("joinCode.introEmpty")}${introSuffix}`)}
        <div className="space-y-4">
          {expirySelect}
          <Button
            onClick={() => createJoinCode({ id: experimentId, expiresIn })}
            isLoading={isCreating}
          >
            {t("joinCode.create")}
          </Button>
        </div>
      </>
    );
  }

  const formattedCode = formatJoinCode(joinCode.code);
  const landingUrl = `${origin}/${LANDING_LOCALE}/join/${formattedCode}`;
  const expiresAtValue = joinCode.expiresAt;

  if (expiresAtValue !== null && isExpired) {
    return (
      <>
        {header()}
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
        </div>
      </>
    );
  }

  return (
    <>
      {header(`${t("joinCode.introActive")}${introSuffix}`)}

      <div className="flex flex-wrap items-center gap-8">
        <div
          className="overflow-hidden rounded-md border"
          role="img"
          aria-label={t("joinCode.qrLabel")}
        >
          <QrCode value={landingUrl} size={DIALOG_QR_SIZE} />
        </div>
        <div className="min-w-56 flex-1 space-y-2">
          <p className="font-mono text-4xl font-bold tracking-widest">{formattedCode}</p>
          <p className="text-muted-foreground text-sm">
            {expiresAtValue === null
              ? t("joinCode.neverExpires")
              : t("joinCode.expiresOn", { date: formatShortDate(expiresAtValue, locale) })}
            {" · "}
            {t("joinCode.redeemed", { joined: joinCode.redemptionCount })}
          </p>
        </div>
      </div>

      {/* Full width rather than beside the code: four actions do not fit the
          column left over by a projector-sized QR, and Revoke wrapped alone. */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => void copy(formattedCode)}>
          {t("joinCode.copyCode")}
        </Button>
        <Button variant="outline" onClick={() => void copy(landingUrl)}>
          {t("joinCode.copyLink")}
        </Button>
        <Button variant="outline" disabled={isMutating} onClick={() => setConfirming("regenerate")}>
          {t("joinCode.regenerate")}
        </Button>
        {/* The danger colour belongs on the confirm, not on a button sitting in
            the row someone reaches for to copy a code. */}
        <Button
          variant="outline"
          className="text-destructive hover:text-destructive"
          disabled={isMutating}
          onClick={() => setConfirming("revoke")}
        >
          {t("joinCode.revoke")}
        </Button>
      </div>

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
              className={
                confirming === "revoke"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : undefined
              }
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
