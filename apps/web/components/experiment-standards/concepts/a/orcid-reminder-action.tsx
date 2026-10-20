"use client";

import { useCopyToClipboard } from "~/hooks/useCopyToClipboard";
import { useLocale } from "~/hooks/useLocale";

import { useTranslation } from "@repo/i18n";
import type { ButtonProps } from "@repo/ui/components/button";
import { Button } from "@repo/ui/components/button";

interface OrcidReminderActionProps {
  variant: ButtonProps["variant"];
}

/** Authors connect ORCID themselves, so the step hands the researcher a message to send them. */
export function OrcidReminderAction({ variant }: OrcidReminderActionProps) {
  const { t } = useTranslation("readinessConceptA");
  const locale = useLocale();
  const { copy, copied } = useCopyToClipboard();

  const handleCopy = () => {
    const accountUrl = new URL(`/${locale}/platform/account`, window.location.origin);
    void copy(t("reminder", { url: accountUrl.toString() }));
  };

  return (
    <Button size="sm" variant={variant} onClick={handleCopy}>
      {copied ? t("reminderCopied") : t("action.connect-orcid")}
    </Button>
  );
}
