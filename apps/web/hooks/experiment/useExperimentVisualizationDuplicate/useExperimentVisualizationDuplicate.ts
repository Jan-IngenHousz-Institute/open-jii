import { useAutosaveStatus } from "@/components/shared/autosave/autosave-status-context";
import { orpc } from "@/lib/orpc";
import { useIsMutating, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { parseApiError } from "~/util/apiError";

import type { ExperimentVisualization } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";
import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks/use-toast";

import { useExperimentVisualizationCreate } from "../useExperimentVisualizationCreate/useExperimentVisualizationCreate";

export function useExperimentVisualizationDuplicate(
  experimentId: string,
  visualizationId: string | undefined,
) {
  const queryClient = useQueryClient();
  const { t } = useTranslation("experimentVisualizations");
  const autosave = useAutosaveStatus();
  const pendingSaves = useIsMutating({
    mutationKey: orpc.experiments.updateExperimentVisualization.key(),
    predicate: ({ state: { variables } }) =>
      typeof variables === "object" &&
      variables !== null &&
      "id" in variables &&
      variables.id === experimentId &&
      "visualizationId" in variables &&
      variables.visualizationId === visualizationId,
  });
  const { mutateAsync: create } = useExperimentVisualizationCreate({ experimentId });
  const [isDuplicating, setIsDuplicating] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const disabled = isDuplicating || pendingSaves > 0 || !!autosave?.hasUnsavedChanges;

  async function duplicate(): Promise<ExperimentVisualization | undefined> {
    if (!visualizationId || busy.current || disabled) return;
    busy.current = true;
    setIsDuplicating(true);
    try {
      const source = await queryClient.fetchQuery(
        orpc.experiments.getExperimentVisualization.queryOptions({
          input: { id: experimentId, visualizationId },
          staleTime: 0,
        }),
      );
      const charts = await queryClient.fetchQuery(
        orpc.experiments.listExperimentVisualizations.queryOptions({
          input: { id: experimentId },
          staleTime: 0,
        }),
      );
      const names = new Set(charts.map((chart) => chart.name));
      return await create({
        id: experimentId,
        name: visualizationCopyName(source.name, names),
        description: source.description ?? undefined,
        chartFamily: source.chartFamily,
        chartType: source.chartType,
        config: source.config,
        dataConfig: source.dataConfig,
      });
    } catch (error) {
      toast({
        title: t("ui.messages.duplicateFailed"),
        description: parseApiError(error)?.message,
        variant: "destructive",
      });
    } finally {
      busy.current = false;
      if (mounted.current) setIsDuplicating(false);
    }
  }

  return { duplicate, disabled };
}

function visualizationCopyName(name: string, taken: ReadonlySet<string>): string {
  for (let number = 1; ; number++) {
    const suffix = number === 1 ? " (copy)" : ` (copy) ${number}`;
    const prefix = name.slice(0, 255 - suffix.length).replace(/[\uD800-\uDBFF]$/, "");
    const candidate = `${prefix}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}
