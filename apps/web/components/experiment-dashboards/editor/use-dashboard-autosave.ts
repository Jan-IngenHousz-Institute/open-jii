"use client";

import { useExperimentDashboardUpdate } from "@/hooks/experiment/useExperimentDashboardUpdate/useExperimentDashboardUpdate";
import { useEffect, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { UpdateExperimentDashboardBody } from "@repo/api/schemas/experiment.schema";

import type { DashboardFormValues } from "./dashboard-form-values";
import { useDashboardSaveStatus } from "./dashboard-save-context";

interface UseDashboardAutosaveOptions {
  form: UseFormReturn<DashboardFormValues>;
  experimentId: string;
  dashboardId: string;
  delayMs?: number;
}

/**
 * Mirrors the visualization editor's autosave: subscribe to RHF watch
 * events, debounce writes, guard against late-resolving saves clobbering
 * fresh ones, and distinguish "fully saved" from "saved but more edits
 * arrived in flight". See `apps/web/components/experiment-visualizations/
 * workspace/use-autosave.ts` for the reference implementation; the only
 * differences here are the mutation hook and form value type.
 */
export function useDashboardAutosave({
  form,
  experimentId,
  dashboardId,
  delayMs = 1500,
}: UseDashboardAutosaveOptions) {
  const status = useDashboardSaveStatus();
  const { mutateAsync } = useExperimentDashboardUpdate({ experimentId });

  interface AutosaveCtx {
    status: ReturnType<typeof useDashboardSaveStatus>;
    mutateAsync: typeof mutateAsync;
    experimentId: string;
    dashboardId: string;
  }
  const ctxRef = useRef<AutosaveCtx>({ status, mutateAsync, experimentId, dashboardId });
  ctxRef.current = { status, mutateAsync, experimentId, dashboardId };

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqRef = useRef(0);
  const latestAppliedRef = useRef(0);
  const hasEditsSinceFireRef = useRef(false);

  useEffect(() => {
    const editsInFlight = () => hasEditsSinceFireRef.current;

    const runSave = async (snapshot: DashboardFormValues) => {
      hasEditsSinceFireRef.current = false;
      const seq = ++seqRef.current;
      const ctx = ctxRef.current;
      ctx.status.markSaving();
      try {
        const body: UpdateExperimentDashboardBody = {
          name: snapshot.name,
          description: snapshot.description,
          layout: snapshot.layout,
          widgets: snapshot.widgets,
        };
        await ctx.mutateAsync({
          params: { id: ctx.experimentId, dashboardId: ctx.dashboardId },
          body,
        });
        if (seq < latestAppliedRef.current) return;
        latestAppliedRef.current = seq;
        if (editsInFlight()) {
          ctx.status.markSavingDone();
        } else {
          ctx.status.markSaved();
        }
      } catch {
        if (seq < latestAppliedRef.current) return;
        latestAppliedRef.current = seq;
        ctx.status.markFailed();
      }
    };

    const subscription = form.watch((values, info) => {
      const eventType = info.type as string | undefined;
      if (eventType === "blur" || eventType === "reset") return;
      if (!info.name) return;
      ctxRef.current.status.markChanged();
      hasEditsSinceFireRef.current = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void runSave(values as DashboardFormValues);
      }, delayMs);
    });
    return () => {
      subscription.unsubscribe();
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [form, delayMs]);
}
