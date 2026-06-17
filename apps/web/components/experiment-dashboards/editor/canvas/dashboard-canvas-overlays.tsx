"use client";

import { LayoutGrid } from "lucide-react";

import { useTranslation } from "@repo/i18n";

/** Centred placeholder shown when the dashboard has no widgets and isn't in placement mode. */
export function DashboardCanvasEmptyState() {
  const { t } = useTranslation("experimentDashboards");
  return (
    <div
      aria-hidden
      className="text-muted-foreground pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center gap-2"
    >
      <LayoutGrid className="h-8 w-8 opacity-60" />
      <span className="text-sm font-medium">{t("ui.messages.emptyDashboard")}</span>
      <span className="text-xs">{t("ui.messages.emptyDashboardEditorHint")}</span>
    </div>
  );
}

/** Dashed rectangle rendered at the would-be drop location during placement. */
export function PlacementGhost() {
  const { t } = useTranslation("experimentDashboards");
  return (
    <div
      aria-hidden
      className="border-primary/70 bg-primary/15 pointer-events-none flex h-full w-full items-center justify-center rounded-md border-2 border-dashed"
    >
      <div className="bg-primary/15 text-primary rounded px-2 py-0.5 text-xs font-medium">
        {t("editor.modebar.dropHint")}
      </div>
    </div>
  );
}
