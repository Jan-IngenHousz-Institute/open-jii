"use client";

import { useTranslation } from "@repo/i18n";

/**
 * "Last used" marker overlaid on the login method the user signed in with
 * most recently (tracked by the lastLoginMethod plugin cookie).
 */
export function LastUsedBadge() {
  const { t } = useTranslation();

  return (
    <span className="bg-secondary text-secondary-foreground absolute -right-1 -top-2 rounded-full px-2 py-0.5 text-[10px] font-medium shadow-sm">
      {t("auth.lastUsed")}
    </span>
  );
}
