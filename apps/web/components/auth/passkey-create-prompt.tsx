"use client";

import { CheckCircle2, Fingerprint, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAddPasskey } from "~/hooks/auth/useAddPasskey/useAddPasskey";
import { usePasskeys } from "~/hooks/auth/usePasskeys/usePasskeys";

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

/**
 * After a non-passkey sign-in, users without a passkey are invited to create
 * one on the spot (Google passkey UX journey: invite, run the OS ceremony,
 * confirm). Shown at most once per session and three times overall; "Not now"
 * on the third strike, or creating a passkey, silences it for good.
 */
export function PasskeyCreatePrompt() {
  const { t } = useTranslation("account");
  const { data: passkeys } = usePasskeys();
  const addPasskey = useAddPasskey();
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState(false);
  const prompted = useRef(false);

  useEffect(() => {
    if (prompted.current || !passkeys || passkeys.length > 0) return;
    if (localStorage.getItem(DISMISSED_KEY) === "true") return;
    if (sessionStorage.getItem(SHOWN_KEY) === "true") return;
    if (authClient.getLastUsedLoginMethod() === "passkey") return;
    const count = Number(localStorage.getItem(COUNT_KEY) ?? "0");
    if (count >= MAX_PROMPTS) return;
    prompted.current = true;
    sessionStorage.setItem(SHOWN_KEY, "true");
    localStorage.setItem(COUNT_KEY, String(count + 1));
    if (count + 1 >= MAX_PROMPTS) localStorage.setItem(DISMISSED_KEY, "true");
    setOpen(true);
  }, [passkeys]);

  const handleCreate = async () => {
    try {
      await addPasskey.mutateAsync({});
      localStorage.setItem(DISMISSED_KEY, "true");
      setCreated(true);
    } catch {
      toast({ description: t("passkeys.addError"), variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
              <Button variant="ghost" className="w-full" onClick={() => setOpen(false)}>
                {t("passkeys.promptNotNow")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
