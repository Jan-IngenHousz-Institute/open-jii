import { useExperimentVisualizationIndex } from "@/hooks/experiment/useExperimentVisualizationIndex/useExperimentVisualizationIndex";

import type { ExperimentDashboardWidget } from "@repo/api/domains/experiment/dashboards/experiment-dashboards.schema";

/**
 * The tables a dashboard's charts and table widgets read, so its freshness
 * reports their newest data rather than the whole experiment's. Undefined
 * while no widget names a table yet.
 */
export function useDashboardTableNames(
  experimentId: string,
  widgets: ExperimentDashboardWidget[],
): string[] | undefined {
  const { data: visualizations } = useExperimentVisualizationIndex(experimentId);
  const tableByVisualization = new Map(
    (visualizations ?? []).map((visualization) => [
      visualization.id,
      visualization.dataConfig.tableName,
    ]),
  );

  const tableOf = (widget: ExperimentDashboardWidget): string | undefined => {
    if (widget.type === "visualization") {
      return widget.config.visualizationId === undefined
        ? undefined
        : tableByVisualization.get(widget.config.visualizationId);
    }
    return widget.type === "table" ? widget.config.tableName : undefined;
  };

  const names = [...new Set(widgets.flatMap((widget) => tableOf(widget) ?? []))];
  return names.length > 0 ? names : undefined;
}
