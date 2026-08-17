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
  /** Identity of what is re-run; lets callers build a stable cache key. */
  macroId: string;
  workbookVersionId: string;
  rawMeasurement: Record<string, unknown>;
  ctx: Record<string, unknown>;
}

export type MacroPreviewState =
  | { status: "loading" }
  | { status: "ready"; preview: MacroPreview }
  /** Nothing to re-run, or the macro snapshot couldn't be reached. */
  | {
      status: "unavailable";
      blocker:
        | MacroPreviewBlocker
        /** The version carries no snapshot of the macro that ran. */
        | "macro-not-found"
        /** The experiment left the member list (unshared or deleted). */
        | "experiment-unavailable"
        /** The version read succeeded but returned nothing: it is gone. */
        | "version-unavailable"
        /** The version read failed outright: genuinely a connectivity problem. */
        | "offline";
    };

/**
 * Resolves everything needed to re-run a stored measurement's macro: the
 * payload (sample envelope restored), the ctx recorded at capture time, and the
 * macro code from the immutable workbook version that produced it, so the
 * result matches what the analysis step showed at capture time.
 *
 * The caller mounts this only once a measurement is opened, so opening one
 * measurement pays for one workbook-version read and the list pays nothing.
 */
export function useMeasurementMacroPreview(measurement: StoredMeasurement): MacroPreviewState {
  const resolved = useMemo(() => resolveMacroPreviewSource(measurement), [measurement]);
  const source = resolved.ok ? resolved.source : undefined;

  const { workbookId, isLoading: isRefLoading } = useExperimentWorkbookRef(source?.experimentId);
  const {
    data: version,
    isLoading: isVersionLoading,
    error: versionError,
  } = useWorkbookVersionQuery(source ? workbookId : undefined, source?.workbookVersionId);

  const macro = useMemo(
    () => (source ? findMacroSnapshot(version, source.macroId) : undefined),
    [version, source],
  );

  if (!resolved.ok) return { status: "unavailable", blocker: resolved.blocker };
  if (!source || isRefLoading || isVersionLoading) return { status: "loading" };
  // No workbook id: the experiment is gone from the member list (unshared or
  // deleted), so its workbook is out of reach. Not a connectivity problem.
  if (!workbookId) return { status: "unavailable", blocker: "experiment-unavailable" };
  // The version read itself failed: this is the genuinely offline case.
  if (versionError) return { status: "unavailable", blocker: "offline" };
  // The read succeeded but returned nothing: the pinned version is gone.
  if (!version) return { status: "unavailable", blocker: "version-unavailable" };
  if (!macro) return { status: "unavailable", blocker: "macro-not-found" };

  return {
    status: "ready",
    preview: {
      macro,
      macroId: source.macroId,
      workbookVersionId: source.workbookVersionId,
      rawMeasurement: source.rawMeasurement,
      ctx: source.ctx,
    },
  };
}

// The version's snapshot holds the code that ran; the macro cell holds the
// language it was written in. Mirrors hydrateFlowNodes for the live flow.
// publish-version snapshots exactly the macros its cells reference, so a cell
// is guaranteed whenever a snapshot exists; a missing cell means the version
// genuinely doesn't carry this macro. Reporting not-found beats guessing a
// language: applyMacro reads "" as JavaScript, which would silently run a
// stored Python macro as JS.
function findMacroSnapshot(
  version: WorkbookVersion | undefined,
  macroId: string,
): { code: string; language: string } | undefined {
  const code = version?.entitySnapshots?.macros?.[macroId]?.code;
  if (!code) return undefined;
  const cell = version?.cells?.find((c) => c.type === "macro" && c.payload.macroId === macroId);
  if (cell?.type !== "macro") return undefined;
  return { code, language: cell.payload.language };
}
