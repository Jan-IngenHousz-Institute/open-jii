"use client";

import { MousePointer2, Redo2, Undo2 } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Separator } from "@repo/ui/components/separator";
import { TooltipProvider } from "@repo/ui/components/tooltip";

import type { PlacementTool } from "../widgets/widget-meta";
import { widgetMetaForTool } from "../widgets/widget-meta";
import type { DashboardTool } from "./context/dashboard-editor-context";
import { useDashboardEditor } from "./context/dashboard-editor-context";
import { ToolButton } from "./tool-button";
import { ToolbarShell } from "./toolbar-shell";

const PLACEMENT_TOOLS: PlacementTool[] = ["chart", "text", "table", "filter"];

interface DashboardModebarProps {
  visible: boolean;
}

// Placement modebar shown when no widget is selected: cursor + four
// widget-type placement tools + undo/redo, in a floating pill.
export function DashboardModebar({ visible }: DashboardModebarProps) {
  const { t } = useTranslation("experimentDashboards");
  const { tool, setTool } = useDashboardEditor();
  const pickTool = (next: DashboardTool) => {
    setTool(tool === next ? "cursor" : next);
  };
  const noop = () => undefined;

  return (
    <TooltipProvider delayDuration={200}>
      <ToolbarShell visible={visible}>
        <ToolButton
          icon={MousePointer2}
          label={t("editor.modebar.cursor")}
          active={tool === "cursor"}
          onClick={() => setTool("cursor")}
        />
        <Separator orientation="vertical" className="mx-0.5 h-5" />
        {PLACEMENT_TOOLS.map((placementTool) => {
          const meta = widgetMetaForTool(placementTool);
          return (
            <ToolButton
              key={placementTool}
              icon={meta.icon}
              label={t(meta.labelKey)}
              active={tool === placementTool}
              onClick={() => pickTool(placementTool)}
            />
          );
        })}
        <Separator orientation="vertical" className="mx-0.5 h-5" />
        <ToolButton icon={Undo2} label={t("editor.modebar.undo")} disabled onClick={noop} />
        <ToolButton icon={Redo2} label={t("editor.modebar.redo")} disabled onClick={noop} />
      </ToolbarShell>
    </TooltipProvider>
  );
}
