import { useMemo } from "react";
import { useWorkbookVersionQuery } from "~/features/experiments/hooks/use-experiment-flow-query";
import { useExperimentWorkbookRef } from "~/features/experiments/hooks/use-experiment-workbook-ref";
import type { MacroPreviewBlocker } from "~/features/recent-measurements/utils/resolve-macro-preview-source";
import { resolveMacroPreviewSource } from "~/features/recent-measurements/utils/resolve-macro-preview-source";
import type { StoredMeasurement } from "~/shared/db/measurements-storage";

import type { WorkbookVersion } from "@repo/api/domains/workbook/workbook-version.schema";

export interface MacroPreview {
  /** Macro code + language, in the shape applyMacro expects. */
  macro: { code: string; language: string };
  rawMeasurement: Record<string, unknown>;
  ctx: Record<string, unknown>;
}

export type MacroPreviewState =
  | { status: "loading" }
  | { status: "ready"; preview: MacroPreview }
  /** Nothing to re-run, or the macro snapshot couldn't be reached. */
  | { status: "unavailable"; blocker: MacroPreviewBlocker | "macro-not-found" | "offline" };

/**
 * Resolves everything needed to re-run a stored measurement's macro: the
 * payload (sample envelope restored), the ctx recorded at capture time, and the
 * macro code from the immutable workbook version that produced it, so the
 * result matches what the analysis step showed at capture time.
 *
 * Nothing is fetched until `enabled` flips, so opening one measurement pays for
 * one workbook-version read and the list itself pays nothing.
 */
export function useMeasurementMacroPreview(
  measurement: StoredMeasurement | undefined,
  enabled: boolean,
): MacroPreviewState {
  const resolved = useMemo(
    () => (measurement ? resolveMacroPreviewSource(measurement) : undefined),
    [measurement],
  );
  const source = resolved?.ok ? resolved.source : undefined;
  const active = enabled && !!source;

  const { workbookId, isLoading: isRefLoading } = useExperimentWorkbookRef(
    active ? source.experimentId : undefined,
  );
  const {
    data: version,
    isLoading: isVersionLoading,
    error: versionError,
  } = useWorkbookVersionQuery(
    active ? workbookId : undefined,
    active ? source.workbookVersionId : undefined,
  );

  const macro = useMemo(
    () => (source ? findMacroSnapshot(version, source.macroId) : undefined),
    [version, source],
  );

  if (!resolved) return { status: "loading" };
  if (!resolved.ok) return { status: "unavailable", blocker: resolved.blocker };
  if (!source || !enabled || isRefLoading || isVersionLoading) return { status: "loading" };
  // No workbook id (experiment gone from the member list) or a failed version
  // read with nothing cached: the snapshot is simply out of reach here.
  if (!workbookId || versionError || !version) return { status: "unavailable", blocker: "offline" };
  if (!macro) return { status: "unavailable", blocker: "macro-not-found" };

  return {
    status: "ready",
    preview: { macro, rawMeasurement: source.rawMeasurement, ctx: source.ctx },
  };
}

// The version's snapshot holds the code that ran; the macro cell holds the
// language it was written in. Mirrors hydrateFlowNodes for the live flow.
function findMacroSnapshot(
  version: WorkbookVersion | undefined,
  macroId: string,
): { code: string; language: string } | undefined {
  const code = version?.entitySnapshots?.macros?.[macroId]?.code;
  if (!code) return undefined;
  const cell = version?.cells?.find((c) => c.type === "macro" && c.payload.macroId === macroId);
  const language = cell?.type === "macro" ? cell.payload.language : "";
  return { code, language };
}
