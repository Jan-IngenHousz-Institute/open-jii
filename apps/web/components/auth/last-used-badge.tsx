"use client";

import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";

/**
 * "Last used" marker overlaid on the login method the user signed in with
 * most recently (tracked by the lastLoginMethod plugin cookie).
 */
export function LastUsedBadge() {
  const { t } = useTranslation();

  return (
    <Badge variant="secondary" className="absolute -right-2 -top-2 shadow-sm">
      {t("auth.lastUsed")}
    </Badge>
  );
}
