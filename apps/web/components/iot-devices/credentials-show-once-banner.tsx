"use client";

import { AlertTriangle } from "lucide-react";

import { useTranslation } from "@repo/i18n";

/** The keys in view exist only in the current response; closing loses them. */
export function CredentialsShowOnceBanner() {
  const { t } = useTranslation("iot");

  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
      <span>{t("iot.devices.credentials.showOnceWarning")}</span>
    </div>
  );
}
