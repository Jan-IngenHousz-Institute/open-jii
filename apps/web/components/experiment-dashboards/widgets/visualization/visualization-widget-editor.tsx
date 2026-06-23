"use client";

import { BarChart3 } from "lucide-react";

import type { ExperimentVisualizationWidget } from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n";

import VisualizationWidgetView from "./visualization-widget";

interface VisualizationWidgetEditorProps {
  widget: ExperimentVisualizationWidget;
  experimentId: string;
}

// Default export for next/dynamic; named export pulls Plotly into SSR.
export default function VisualizationWidgetEditor({
  widget,
  experimentId,
}: VisualizationWidgetEditorProps) {
  const { t } = useTranslation("experimentDashboards");
  const visualizationId = widget.config.visualizationId;

  if (!visualizationId) {
    return (
      <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <div className="bg-muted/40 flex size-10 items-center justify-center rounded-full">
          <BarChart3 className="size-5" />
        </div>
        <div className="text-foreground text-sm font-medium">
          {t("editor.visualizationConfig.pickVisualization")}
        </div>
        <p className="text-xs">{t("editor.visualizationConfig.pickHint")}</p>
      </div>
    );
  }

  return <VisualizationWidgetView widget={widget} experimentId={experimentId} />;
}
