"use client";

import { CheckCircle2, Fingerprint, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAddPasskey } from "~/hooks/auth/useAddPasskey/useAddPasskey";
import { usePasskeys } from "~/hooks/auth/usePasskeys/usePasskeys";
import { useWebAuthnSupport } from "~/hooks/auth/useWebAuthnSupport/useWebAuthnSupport";

import { authClient } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { toast } from "@repo/ui/hooks/use-toast";

const DISMISSED_KEY = "openjii.passkey-prompt-dismissed";
const COUNT_KEY = "openjii.passkey-prompt-count";
const SHOWN_KEY = "openjii.passkey-prompt-shown";
const MAX_PROMPTS = 3;

function userStorageKey(key: string, userId: string) {
  return `${key}:${userId}`;
}

/**
 * After a non-passkey sign-in, users without a passkey are invited to create
 * one on the spot (Google passkey UX journey: invite, run the OS ceremony,
 * confirm). Shown at most once per auth session; a user's third dismissal, or
 * creating a passkey, silences it for good in this browser.
 */
export function PasskeyCreatePrompt({ userId, sessionId }: { userId: string; sessionId: string }) {
  const { t } = useTranslation("account");
  const { data: passkeys } = usePasskeys();
  const addPasskey = useAddPasskey();
  const webAuthnSupported = useWebAuthnSupport();
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState(false);
  const prompted = useRef(false);
  const dismissedKey = userStorageKey(DISMISSED_KEY, userId);
  const countKey = userStorageKey(COUNT_KEY, userId);
  const shownKeyPrefix = `${userStorageKey(SHOWN_KEY, userId)}:`;
  const shownKey = `${shownKeyPrefix}${sessionId}`;

  useEffect(() => {
    if (!webAuthnSupported || prompted.current || !passkeys || passkeys.length > 0) return;
    if (localStorage.getItem(dismissedKey) === "true") return;
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(shownKeyPrefix) && key !== shownKey) localStorage.removeItem(key);
    }
    if (localStorage.getItem(shownKey) === "true") return;
    if (authClient.getLastUsedLoginMethod() === "passkey") return;
    const count = Number(localStorage.getItem(countKey) ?? "0");
    if (count >= MAX_PROMPTS) return;
    prompted.current = true;
    localStorage.setItem(shownKey, "true");
    setOpen(true);
  }, [countKey, dismissedKey, passkeys, shownKey, shownKeyPrefix, webAuthnSupported]);

  useEffect(() => {
    const closeDuplicatePrompt = (event: StorageEvent) => {
      if (event.key === shownKey && event.newValue === "true") setOpen(false);
    };
    window.addEventListener("storage", closeDuplicatePrompt);
    return () => window.removeEventListener("storage", closeDuplicatePrompt);
  }, [shownKey]);

  const handleDismiss = () => {
    const count = Number(localStorage.getItem(countKey) ?? "0") + 1;
    localStorage.setItem(countKey, String(count));
    if (count >= MAX_PROMPTS) localStorage.setItem(dismissedKey, "true");
    setOpen(false);
  };

  const handleCreate = async () => {
    try {
      await addPasskey.mutateAsync({});
      localStorage.setItem(dismissedKey, "true");
      setCreated(true);
    } catch {
      toast({ description: t("passkeys.addError"), variant: "destructive" });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) setOpen(true);
        else if (created) setOpen(false);
        else handleDismiss();
      }}
    >
      <DialogContent className="max-w-md">
        {created ? (
          <>
            <DialogHeader>
              <div className="flex justify-center py-2">
                <CheckCircle2 className="text-jii-dark-green h-10 w-10" />
              </div>
              <DialogTitle className="text-center">{t("passkeys.promptSuccessTitle")}</DialogTitle>
              <DialogDescription className="text-center">
                {t("passkeys.promptSuccessDescription")}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button className="w-full" onClick={() => setOpen(false)}>
                {t("passkeys.promptDone")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex justify-center py-2">
                <Fingerprint className="text-muted-foreground h-10 w-10" />
              </div>
              <DialogTitle className="text-center">{t("passkeys.promptTitle")}</DialogTitle>
              <DialogDescription className="text-center">
                {t("passkeys.promptDescription")}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button className="w-full" onClick={handleCreate} disabled={addPasskey.isPending}>
                {addPasskey.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("passkeys.promptAction")}
              </Button>
              <Button variant="ghost" className="w-full" onClick={handleDismiss}>
                {t("passkeys.promptNotNow")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
