"use client";

import { useExperimentVisualizationUpdate } from "@/hooks/experiment/useExperimentVisualizationUpdate/useExperimentVisualizationUpdate";
import { useAutosave } from "@/hooks/useAutosave";
import { useCallback } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

import type { UpdateExperimentVisualizationBody } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";

import { useReportAutosaveStatus } from "../../../shared/autosave/autosave-status-context";
import type { ChartFormValues } from "../../charts/chart-config";
import { sanitizeDataConfigForSave } from "../../charts/data/aggregation";

// Module-scoped: inline arrows churn useAutosave's memo every render.
const stringifyChart = (v: ChartFormValues) => JSON.stringify(v);

interface UseVisualizationAutosaveOptions {
  form: UseFormReturn<ChartFormValues>;
  experimentId: string;
  visualizationId: string;
}

export function useVisualizationAutosave({
  form,
  experimentId,
  visualizationId,
}: UseVisualizationAutosaveOptions) {
  const values = useWatch({ control: form.control }) as ChartFormValues;
  const { mutateAsync } = useExperimentVisualizationUpdate({ experimentId });

  const save = useCallback(
    async (snapshot: ChartFormValues) => {
      const body: UpdateExperimentVisualizationBody = {
        ...snapshot,
        dataConfig: sanitizeDataConfigForSave(snapshot.dataConfig),
        config: { ...snapshot.config },
      };
      await mutateAsync({ id: experimentId, visualizationId, ...body });
    },
    [mutateAsync, experimentId, visualizationId],
  );

  const autosave = useAutosave<ChartFormValues>({
    value: values,
    toKey: stringifyChart,
    save,
  });
  useReportAutosaveStatus(autosave);
}
