"use client";

import { useExperimentVisualizationUpdate } from "@/hooks/experiment/useExperimentVisualizationUpdate/useExperimentVisualizationUpdate";
import { useEffect, useRef } from "react";
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
  const status = useVisualizationSaveStatus();
  const { mutateAsync } = useExperimentVisualizationUpdate({ experimentId });

  // Stash dependencies in a ref so the watch subscription can attach exactly
  // once per form. The previous shape re-attached on every parent render
  // because `mutateAsync` and the status callbacks are fresh refs each call,
  // which constantly cancelled the pending debounce timer mid-typing.
  interface AutosaveCtx {
    status: ReturnType<typeof useVisualizationSaveStatus>;
    mutateAsync: typeof mutateAsync;
    experimentId: string;
    visualizationId: string;
  }
  const ctxRef = useRef<AutosaveCtx>({ status, mutateAsync, experimentId, visualizationId });
  ctxRef.current = { status, mutateAsync, experimentId, visualizationId };

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Save-version guard. Each fired save gets a monotonically increasing seq;
  // we ignore late resolutions whose seq is older than the last one we
  // already applied, so a slow save can't clobber a fresh save's UI state.
  const seqRef = useRef(0);
  const latestAppliedRef = useRef(0);
  // True between a watch-fired change and the next save-fire. Lets us tell
  // "saved everything the user has typed" from "saved an older snapshot,
  // user has typed more in flight". The latter must keep `isDirty` set.
  const hasEditsSinceFireRef = useRef(false);

  useEffect(() => {
    // Indirected read so the linter doesn't conclude the post-await check is
    // dead — the ref is mutated by the watch callback during the in-flight
    // window, not by code in this function's syntactic flow.
    const editsInFlight = () => hasEditsSinceFireRef.current;

    const runSave = async (snapshot: ChartFormValues) => {
      // Snapshot taken — anything after this counts as "edits in flight".
      hasEditsSinceFireRef.current = false;
      const seq = ++seqRef.current;
      const ctx = ctxRef.current;
      ctx.status.markSaving();
      try {
        await ctx.mutateAsync({
          params: { id: ctx.experimentId, visualizationId: ctx.visualizationId },
          body: {
            ...snapshot,
            config: snapshot.config as unknown as Record<string, unknown>,
          } satisfies CreateExperimentVisualizationBody,
        });
        if (seq < latestAppliedRef.current) return;
        latestAppliedRef.current = seq;
        if (editsInFlight()) {
          // User typed more between save-fire and resolve; the next debounced
          // save will catch those. Clear "saving" but leave `isDirty` set.
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
      // RHF emits with `info.type === "change"` for native input events via
      // register, but `setValue` calls (and Controller's `field.onChange`
      // path internally) emit with NO `type`. Filter the noise we don't want
      // (focus blur, programmatic reset) and treat anything else as a real
      // value change worth saving — that's what covers the chart-type
      // switch, table-pick Selects, and any field-array mutation.
      const eventType = info.type as string | undefined;
      if (eventType === "blur" || eventType === "reset") return;
      // Real edits always carry the field name that changed. RHF can also
      // emit nameless events during mount and internal state syncs (e.g.
      // when useFieldArray subscribes), which would otherwise schedule a
      // bogus save right after the chart first paints. Drop those.
      if (!info.name) return;
      ctxRef.current.status.markChanged();
      hasEditsSinceFireRef.current = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void runSave(values as ChartFormValues);
      }, delayMs);
    });
    return () => {
      subscription.unsubscribe();
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [form, delayMs]);
}
