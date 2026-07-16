"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { usePasskeys } from "~/hooks/auth/usePasskeys/usePasskeys";

import { authClient } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { ToastAction } from "@repo/ui/components/toast";
import { toast } from "@repo/ui/hooks/use-toast";

const DISMISSED_KEY = "openjii.passkey-prompt-dismissed";
const COUNT_KEY = "openjii.passkey-prompt-count";
const SHOWN_KEY = "openjii.passkey-prompt-shown";
const MAX_PROMPTS = 3;

/**
 * After a non-passkey sign-in, users without a passkey get a dismissible
 * invitation to create one: at most once per session and three times overall;
 * following the prompt silences it for good.
 */
export function PasskeyCreatePrompt({ locale }: { locale: string }) {
  const { t } = useTranslation("account");
  const router = useRouter();
  const { data: passkeys } = usePasskeys();
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
    toast({
      title: t("passkeys.promptTitle"),
      description: t("passkeys.promptDescription"),
      duration: 20000,
      action: (
        <ToastAction
          altText={t("passkeys.promptAction")}
          onClick={() => {
            localStorage.setItem(DISMISSED_KEY, "true");
            router.push(`/${locale}/platform/account/security`);
          }}
        >
          {t("passkeys.promptAction")}
        </ToastAction>
      ),
    });
  }, [passkeys, router, locale, t]);

  return null;
}
