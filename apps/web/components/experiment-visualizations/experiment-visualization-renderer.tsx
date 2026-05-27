"use client";

import type { ExperimentVisualization } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";

import "../../styles/plotly-chart.css";
import { getChartTypeDef } from "./charts/chart-registry";

interface ExperimentVisualizationRendererProps {
  visualization: ExperimentVisualization;
  experimentId: string;
  data?: Record<string, unknown>[] | null;
  showTitle?: boolean;
  showDescription?: boolean;
}

export default function ExperimentVisualizationRenderer({
  visualization,
  experimentId,
  data,
  showTitle = true,
  showDescription = true,
}: ExperimentVisualizationRendererProps) {
  const { t } = useTranslation("experimentVisualizations");
  const def = getChartTypeDef(visualization.chartType);
  const labelKey = def?.labelKey ?? `charts.types.${visualization.chartType}`;

  return (
    <div className="flex h-full w-full flex-col">
      {(showTitle || showDescription) && (
        <div className="mb-6">
          {showTitle && <h2 className="text-2xl font-bold">{visualization.name}</h2>}
          {showDescription && visualization.description && (
            <p className="text-muted-foreground mt-2">{visualization.description}</p>
          )}
        </div>
      )}
      <div className="flex min-h-0 w-full flex-1 flex-col">
        {def ? (
          <def.Renderer
            visualization={visualization}
            experimentId={experimentId}
            data={data ?? undefined}
          />
        ) : (
          <div className="bg-muted/30 text-muted-foreground flex h-full items-center justify-center rounded-lg border border-dashed">
            <div className="text-center">
              <div className="mb-2 text-lg font-medium">{t("errors.unsupportedChartType")}</div>
              <div className="text-sm">
                {t(labelKey, visualization.chartType)} {t("errors.chartTypeNotSupported")}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
