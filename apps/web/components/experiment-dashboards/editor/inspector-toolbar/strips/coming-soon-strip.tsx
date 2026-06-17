"use client";

import { Construction } from "lucide-react";

import { useTranslation } from "@repo/i18n";

/** Placeholder chip for strip slots not yet migrated to the horizontal toolbar. */
export function ComingSoonStrip() {
  const { t } = useTranslation("experimentDashboards");
  return (
    <div className="text-muted-foreground inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs">
      <Construction className="size-3.5" />
      <span>{t("editor.inspector.comingSoon")}</span>
    </div>
  );
}
