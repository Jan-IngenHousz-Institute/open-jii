"use client";

import { useExperimentDashboardUpdate } from "@/hooks/experiment/useExperimentDashboardUpdate/useExperimentDashboardUpdate";
import { useAutosave } from "@/hooks/useAutosave";
import { useCallback, useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

import type { UpdateExperimentDashboardBody } from "@repo/api/domains/experiment/dashboards/experiment-dashboards.schema";

import { useReportAutosaveStatus } from "../../../shared/autosave/autosave-status-context";
import type { DashboardFormValues } from "../../dashboard-form-shell";

// Module-scoped: inline arrows churn useAutosave's memo every render.
const stringifyDashboard = (v: DashboardFormValues) => JSON.stringify(v);

interface UseDashboardAutosaveOptions {
  form: UseFormReturn<DashboardFormValues>;
  experimentId: string;
  dashboardId: string;
  /** The backend's `manage` gate; without it nothing saves and no status is reported. */
  enabled?: boolean;
  onSaved?: (snapshot: DashboardFormValues) => void;
  onUnmountFlushed?: () => void;
}

export function useDashboardAutosave({
  form,
  experimentId,
  dashboardId,
  enabled = true,
  onSaved,
  onUnmountFlushed,
}: UseDashboardAutosaveOptions) {
  const values = useWatch({ control: form.control }) as DashboardFormValues;
  const { mutateAsync } = useExperimentDashboardUpdate({ experimentId });
  const [inFlightWidgetIds, setInFlightWidgetIds] = useState<ReadonlySet<string> | null>(null);
  const onUnmountFlushedRef = useRef(onUnmountFlushed);
  onUnmountFlushedRef.current = onUnmountFlushed;

  const save = useCallback(
    async (snapshot: DashboardFormValues) => {
      const body: UpdateExperimentDashboardBody = {
        name: snapshot.name,
        description: snapshot.description,
        layout: snapshot.layout,
        widgets: snapshot.widgets,
      };
      setInFlightWidgetIds(new Set(snapshot.widgets.map((widget) => widget.id)));
      try {
        await mutateAsync({ id: experimentId, dashboardId, ...body });
        onSaved?.(snapshot);
      } finally {
        setInFlightWidgetIds(null);
      }
    },
    [mutateAsync, experimentId, dashboardId, onSaved],
  );

  const autosave = useAutosave<DashboardFormValues>({
    value: values,
    toKey: stringifyDashboard,
    save,
    enabled,
    flushOnUnmount: false,
  });
  const { flush } = autosave;
  useEffect(() => {
    return () => {
      void flush().then(() => onUnmountFlushedRef.current?.());
    };
  }, [flush]);
  useReportAutosaveStatus({ status: enabled ? autosave.status : null, error: autosave.error });
  return { ...autosave, inFlightWidgetIds };
}
