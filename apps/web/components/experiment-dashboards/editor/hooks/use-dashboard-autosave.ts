"use client";

import { useExperimentDashboardUpdate } from "@/hooks/experiment/useExperimentDashboardUpdate/useExperimentDashboardUpdate";
import { useAutosave } from "@/hooks/useAutosave";
import { useCallback } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

import type { UpdateExperimentDashboardBody } from "@repo/api/schemas/experiment.schema";

import { useReportAutosaveStatus } from "../../../shared/autosave/autosave-status-context";
import type { DashboardFormValues } from "../../dashboard-form-shell";

interface UseDashboardAutosaveOptions {
  form: UseFormReturn<DashboardFormValues>;
  experimentId: string;
  dashboardId: string;
}

export function useDashboardAutosave({
  form,
  experimentId,
  dashboardId,
}: UseDashboardAutosaveOptions) {
  const values = useWatch({ control: form.control }) as DashboardFormValues;
  const { mutateAsync } = useExperimentDashboardUpdate({ experimentId });

  const save = useCallback(
    async (snapshot: DashboardFormValues) => {
      const body: UpdateExperimentDashboardBody = {
        name: snapshot.name,
        description: snapshot.description,
        layout: snapshot.layout,
        widgets: snapshot.widgets,
      };
      await mutateAsync({ params: { id: experimentId, dashboardId }, body });
    },
    [mutateAsync, experimentId, dashboardId],
  );

  const autosave = useAutosave<DashboardFormValues>({
    value: values,
    toKey: (v) => JSON.stringify(v),
    save,
  });
  useReportAutosaveStatus(autosave);
}
