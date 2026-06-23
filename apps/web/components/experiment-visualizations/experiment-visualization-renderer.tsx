"use client";

import type { ExperimentVisualization } from "@repo/api/domains/experiment/experiment.schema";

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
  const def = getChartTypeDef(visualization.chartType);

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
        <def.Renderer
          visualization={visualization}
          experimentId={experimentId}
          data={data ?? undefined}
        />
      </div>
    </div>
  );
}
