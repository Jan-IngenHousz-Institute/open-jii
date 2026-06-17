"use client";

import { MousePointer2 } from "lucide-react";

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
// widget-type placement tools, in a floating pill.
export function DashboardModebar({ visible }: DashboardModebarProps) {
  const { t } = useTranslation("experimentDashboards");
  const { tool, setTool } = useDashboardEditor();
  const pickTool = (next: DashboardTool) => {
    setTool(tool === next ? "cursor" : next);
  };
  const handleCursor = () => setTool("cursor");

  return (
    <TooltipProvider delayDuration={200}>
      <ToolbarShell visible={visible}>
        <ToolButton
          icon={MousePointer2}
          label={t("editor.modebar.cursor")}
          active={tool === "cursor"}
          onClick={handleCursor}
        />
        <Separator orientation="vertical" className="mx-0.5 h-5" />
        {PLACEMENT_TOOLS.map((placementTool) => (
          <PlacementToolButton
            key={placementTool}
            placementTool={placementTool}
            active={tool === placementTool}
            onPick={pickTool}
          />
        ))}
      </ToolbarShell>
    </TooltipProvider>
  );
}

interface PlacementToolButtonProps {
  placementTool: PlacementTool;
  active: boolean;
  onPick: (tool: PlacementTool) => void;
}

function PlacementToolButton({ placementTool, active, onPick }: PlacementToolButtonProps) {
  const { t } = useTranslation("experimentDashboards");
  const meta = widgetMetaForTool(placementTool);
  const handleClick = () => onPick(placementTool);
  return (
    <ToolButton icon={meta.icon} label={t(meta.labelKey)} active={active} onClick={handleClick} />
  );
}
