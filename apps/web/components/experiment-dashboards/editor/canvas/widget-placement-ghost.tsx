"use client";

import { useEffect, useState } from "react";

import { useTranslation } from "@repo/i18n";

import { widgetMetaForTool } from "../../widgets/widget-meta";
import { useDashboardEditor } from "../context/dashboard-editor-context";

export function WidgetPlacementGhost() {
  const { t } = useTranslation("experimentDashboards");
  const { tool } = useDashboardEditor();
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (tool === "cursor") {
      setPos(null);
      return;
    }
    const onMove = (e: PointerEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [tool]);

  if (tool === "cursor" || !pos) {
    return null;
  }

  const meta = widgetMetaForTool(tool);
  const Icon = meta.icon;

  return (
    <div
      style={{ left: pos.x + 12, top: pos.y + 12 }}
      className="bg-card text-foreground pointer-events-none fixed z-[100] flex items-center gap-2 rounded-md border px-2 py-1 text-xs shadow-md"
      aria-hidden
    >
      <Icon className="text-muted-foreground size-3.5" />
      <span className="font-medium">{t(meta.labelKey)}</span>
      <span className="text-muted-foreground">{t("editor.modebar.dropHint")}</span>
    </div>
  );
}
