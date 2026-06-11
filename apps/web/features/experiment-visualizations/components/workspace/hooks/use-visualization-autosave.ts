"use client";

import { useExperimentVisualizationUpdate } from "@/features/experiments/hooks/useExperimentVisualizationUpdate/useExperimentVisualizationUpdate";
import { useAutosave } from "@/shared/hooks/useAutosave";
import { useReportAutosaveStatus } from "@/shared/ui/autosave/autosave-status-context";
import { useCallback } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

import type { UpdateExperimentVisualizationBody } from "@repo/api/schemas/experiment.schema";

import type { ChartFormValues } from "../../charts/chart-config";
import { sanitizeDataConfigForSave } from "../../charts/data/aggregation";

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
      await mutateAsync({ params: { id: experimentId, visualizationId }, body });
    },
    [mutateAsync, experimentId, visualizationId],
  );

  const autosave = useAutosave<ChartFormValues>({
    value: values,
    toKey: (v) => JSON.stringify(v),
    save,
  });
  useReportAutosaveStatus(autosave);
}
