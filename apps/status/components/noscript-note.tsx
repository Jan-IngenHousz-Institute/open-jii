"use client";

import { useTranslation } from "@repo/i18n/client";

export function NoscriptNote() {
  const { t } = useTranslation("status");

  return (
    <noscript>
      <p className="bg-status-stale text-status-stale-foreground px-4 py-3 text-center font-medium">
        {t("noscript")}
      </p>
    </noscript>
  );
}
