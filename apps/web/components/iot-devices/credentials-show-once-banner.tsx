"use client";

import { AlertTriangle } from "lucide-react";

import { useTranslation } from "@repo/i18n";

/** The keys in view exist only in the current response; closing loses them. */
export function CredentialsShowOnceBanner() {
  const { t } = useTranslation("iot");

  return (
    <div className="border-status-stale-foreground/30 bg-status-stale text-status-stale-foreground flex items-start gap-2 rounded-md border p-3 text-sm">
      <AlertTriangle className="text-status-stale-foreground mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{t("iot.devices.credentials.showOnceWarning")}</span>
    </div>
  );
}
