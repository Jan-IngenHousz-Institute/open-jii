"use client";

import { useExperimentVisualizationUpdate } from "@/hooks/experiment/useExperimentVisualizationUpdate/useExperimentVisualizationUpdate";
import { useAutosave } from "@/hooks/useAutosave";
import { useCallback, useEffect, useMemo } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

import { zCreateExperimentVisualizationBody } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";
import type { UpdateExperimentVisualizationBody } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";
import { isDataJoinValid } from "@repo/api/transforms/joined-columns";

import { useReportAutosaveStatus } from "../../../shared/autosave/autosave-status-context";
import type { ChartFormValues } from "../../charts/chart-config";
import { sanitizeDataConfigForSave } from "../../charts/data/aggregation";

// Module-scoped: inline arrows churn useAutosave's memo every render.
const stringifyChart = (v: ChartFormValues) => JSON.stringify(v);
const validateChart = (v: ChartFormValues) =>
  zCreateExperimentVisualizationBody.safeParse({
    ...v,
    dataConfig: sanitizeDataConfigForSave(v.dataConfig),
  });

interface UseVisualizationAutosaveOptions {
  form: UseFormReturn<ChartFormValues>;
  experimentId: string;
  visualizationId: string;
  /** The backend's `manage` gate; without it nothing saves and no status is reported. */
  enabled?: boolean;
}

export function useVisualizationAutosave({
  form,
  experimentId,
  visualizationId,
  enabled = true,
}: UseVisualizationAutosaveOptions) {
  const values = useWatch({ control: form.control }) as ChartFormValues;
  const validation = useMemo(() => validateChart(values), [values]);
  const valid = validation.success && isDataJoinValid(values.dataConfig.join);
  const isValid = useCallback(() => valid, [valid]);
  useEffect(() => {
    void form.trigger();
  }, [form, values]);
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
    isValid,
    save,
    enabled,
  });
  useReportAutosaveStatus({
    status: enabled ? (valid ? autosave.status : "dirty") : null,
    error: autosave.error,
  });
}
