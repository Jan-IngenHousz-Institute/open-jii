"use client";

import { LayoutGrid } from "lucide-react";

import { useTranslation } from "@repo/i18n";

export function DashboardThumbnailEmpty() {
  const { t } = useTranslation("experimentDashboards");
  return (
    <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="bg-muted flex h-16 w-16 items-center justify-center rounded-full">
        <LayoutGrid className="size-7" />
      </div>
      <div className="space-y-1">
        <p className="text-foreground text-sm font-medium">{t("widget.emptyDashboard")}</p>
        <p className="text-muted-foreground text-xs">{t("widget.emptyDashboardDescription")}</p>
      </div>
    </div>
  );
}
