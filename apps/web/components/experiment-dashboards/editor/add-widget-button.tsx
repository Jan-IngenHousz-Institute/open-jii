"use client";

import { BarChart3, FileText, Plus } from "lucide-react";
import { useState } from "react";

import type { DashboardWidget, WidgetLayout } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/popover";

import { getWidgetMinDimensions } from "../widgets/widget-dimensions";

interface AddWidgetButtonProps {
  /**
   * The current widget array. Used to compute the next free row so newly
   * added widgets don't overlap existing ones.
   */
  widgets: DashboardWidget[];
  columns: number;
  onAdd: (widget: DashboardWidget) => void;
}

/**
 * Append-helper: places the new widget on a fresh row below all current
 * widgets at a comfortable starting size that respects the type's minimum.
 * Users can resize after via the grid handles.
 */
function nextLayout(
  type: DashboardWidget["type"],
  widgets: DashboardWidget[],
  columns: number,
): WidgetLayout {
  const maxRow = widgets.reduce((acc, w) => Math.max(acc, w.layout.row + w.layout.rowSpan), 0);
  const { minW, minH } = getWidgetMinDimensions(type);
  return {
    col: 0,
    row: maxRow,
    colSpan: Math.min(Math.max(minW, 6), columns),
    rowSpan: Math.max(minH, 4),
  };
}

function uuid(): string {
  // Crypto.randomUUID is available in modern browsers and Node 19+. The
  // editor is client-only, so this path is safe.
  return crypto.randomUUID();
}

export function AddWidgetButton({ widgets, columns, onAdd }: AddWidgetButtonProps) {
  const { t } = useTranslation("experimentDashboards");
  const [open, setOpen] = useState(false);

  const handlePickVisualization = () => {
    onAdd({
      id: uuid(),
      type: "visualization",
      layout: nextLayout("visualization", widgets, columns),
      config: { showTitle: true, showDescription: false },
    });
    setOpen(false);
  };

  const handlePickRichText = () => {
    onAdd({
      id: uuid(),
      type: "richText",
      layout: nextLayout("richText", widgets, columns),
      config: { html: "" },
    });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          {t("editor.addWidget")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <button
          type="button"
          onClick={handlePickVisualization}
          className="hover:bg-accent flex w-full items-start gap-3 rounded-md p-2 text-left transition-colors"
        >
          <BarChart3 className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <div className="text-sm font-medium">{t("editor.widgetTypes.visualization")}</div>
            <div className="text-muted-foreground text-xs">
              {t("editor.widgetTypes.visualizationDescription")}
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={handlePickRichText}
          className="hover:bg-accent flex w-full items-start gap-3 rounded-md p-2 text-left transition-colors"
        >
          <FileText className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <div className="text-sm font-medium">{t("editor.widgetTypes.richText")}</div>
            <div className="text-muted-foreground text-xs">
              {t("editor.widgetTypes.richTextDescription")}
            </div>
          </div>
        </button>
      </PopoverContent>
    </Popover>
  );
}
