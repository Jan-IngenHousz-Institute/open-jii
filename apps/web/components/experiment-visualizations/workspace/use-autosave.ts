"use client";

import { useExperimentVisualizationUpdate } from "@/hooks/experiment/useExperimentVisualizationUpdate/useExperimentVisualizationUpdate";
import { useCallback, useEffect, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { CreateExperimentVisualizationBody } from "@repo/api/schemas/experiment.schema";

import type { ChartFormValues } from "../charts/form-values";
import { useVisualizationSaveStatus } from "./save-context";

interface UseAutosaveOptions {
  form: UseFormReturn<ChartFormValues>;
  experimentId: string;
  visualizationId: string;
  delayMs?: number;
}

export function useAutosave({
  form,
  experimentId,
  visualizationId,
  delayMs = 1500,
}: UseAutosaveOptions) {
  const { markDirty, markSaving, markSaved, markFailed } = useVisualizationSaveStatus();
  const { mutateAsync } = useExperimentVisualizationUpdate({ experimentId });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    async (values: ChartFormValues) => {
      try {
        markSaving();
        const body: CreateExperimentVisualizationBody = {
          ...values,
          config: values.config as unknown as Record<string, unknown>,
        };
        await mutateAsync({
          params: { id: experimentId, visualizationId },
          body,
        });
        markSaved();
      } catch {
        markFailed();
      }
    },
    [mutateAsync, experimentId, visualizationId, markSaving, markSaved, markFailed],
  );

  useEffect(() => {
    const subscription = form.watch((values, info) => {
      if (info.type !== "change") return;
      markDirty();
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void save(values as ChartFormValues);
      }, delayMs);
    });
    return () => {
      subscription.unsubscribe();
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [form, markDirty, save, delayMs]);
}
