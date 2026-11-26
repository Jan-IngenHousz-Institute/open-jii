"use client";

import { experimentDashboardQuery } from "@/hooks/experiment/useExperimentDashboard/useExperimentDashboard";
import { useExperimentDashboardUpdate } from "@/hooks/experiment/useExperimentDashboardUpdate/useExperimentDashboardUpdate";
import { useAutosave } from "@/hooks/useAutosave";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

import type {
  ExperimentDashboard,
  UpdateExperimentDashboardBody,
} from "@repo/api/domains/experiment/dashboards/experiment-dashboards.schema";

import { useReportAutosaveStatus } from "../../../shared/autosave/autosave-status-context";
import type { DashboardFormValues } from "../../dashboard-form-shell";

// Module-scoped: inline arrows churn useAutosave's memo every render.
const stringifyDashboard = (v: DashboardFormValues) => JSON.stringify(v);

type GetCopyLinks = (locale: string) => { id: string; name: string; href: string }[];

export interface DashboardCloseSave {
  dashboard: Promise<ExperimentDashboard>;
  getCopyLinks?: GetCopyLinks;
}

const pendingCloseSaves = new Map<string, DashboardCloseSave>();

function dashboardKey(experimentId: string, dashboardId: string) {
  return JSON.stringify([experimentId, dashboardId]);
}

export function getPendingDashboardCloseSave(experimentId: string, dashboardId: string) {
  return pendingCloseSaves.get(dashboardKey(experimentId, dashboardId));
}

interface UseDashboardAutosaveOptions {
  form: UseFormReturn<DashboardFormValues>;
  experimentId: string;
  dashboardId: string;
  /** The backend's `manage` gate; without it nothing saves and no status is reported. */
  enabled?: boolean;
  hasEditAccess?: () => boolean;
  onSaved?: (snapshot: DashboardFormValues) => void;
  onUnmountFlushed?: () => void;
  getCopyLinks?: GetCopyLinks;
}

export function useDashboardAutosave({
  form,
  experimentId,
  dashboardId,
  enabled = true,
  hasEditAccess,
  onSaved,
  onUnmountFlushed,
  getCopyLinks,
}: UseDashboardAutosaveOptions) {
  const values = useWatch({ control: form.control }) as DashboardFormValues;
  const { mutateAsync } = useExperimentDashboardUpdate({ experimentId });
  const queryClient = useQueryClient();
  const [inFlightWidgetIds, setInFlightWidgetIds] = useState<ReadonlySet<string> | null>(null);
  const onUnmountFlushedRef = useRef(onUnmountFlushed);
  onUnmountFlushedRef.current = onUnmountFlushed;
  const getCopyLinksRef = useRef(getCopyLinks);
  getCopyLinksRef.current = getCopyLinks;

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
    isValid: hasEditAccess,
    flushOnUnmount: false,
  });
  const { flushIfPending } = autosave;
  useEffect(() => {
    const key = dashboardKey(experimentId, dashboardId);
    const query = experimentDashboardQuery(dashboardId, experimentId);
    return () => {
      const flush = flushIfPending();
      void (flush ?? Promise.resolve()).then(() => onUnmountFlushedRef.current?.());
      if (!flush) return;

      const settledDashboard = flush.then(async () => {
        // A detail request started during the PATCH can still return the old widgets.
        await queryClient.cancelQueries({ queryKey: query.queryKey, exact: true });
        return queryClient.fetchQuery({ ...query, staleTime: 0 });
      });
      const closeSave = { dashboard: settledDashboard, getCopyLinks: getCopyLinksRef.current };
      pendingCloseSaves.set(key, closeSave);
      const clear = () => {
        if (pendingCloseSaves.get(key) === closeSave) pendingCloseSaves.delete(key);
      };
      void settledDashboard.then(clear, clear);
    };
  }, [dashboardId, experimentId, flushIfPending, queryClient]);
  useReportAutosaveStatus({ status: enabled ? autosave.status : null, error: autosave.error });
  return { ...autosave, inFlightWidgetIds };
}
