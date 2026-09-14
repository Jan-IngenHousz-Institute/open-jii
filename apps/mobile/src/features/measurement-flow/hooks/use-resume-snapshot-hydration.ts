import { useEffect } from "react";
import { useWorkbookVersionQuery } from "~/features/experiments/hooks/use-experiment-flow-query";
import { hasUnresolvedSnapshotCode } from "~/features/measurement-flow/domain/flow-snapshots";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { hydrateFlowNodes } from "~/features/measurement-flow/utils/hydrate-flow-nodes";

export type ResumeHydrationState =
  | { status: "ready" }
  | { status: "loading" }
  | { status: "unavailable"; reason: "offline" | "version-missing" | "error" };

function errorStatus(error: unknown): number | undefined {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : undefined;
}

/**
 * Re-attaches protocol/macro snapshot code to a flow resumed from a cold start.
 * The persisted slice omits it and the picker (the only other hydration path)
 * never mounts on resume. MeasurementFlowContainer gates on the returned status.
 */
export function useResumeSnapshotHydration(): ResumeHydrationState {
  const flowNodes = useMeasurementFlowStore((s) => s.flowNodes);
  const workbookId = useMeasurementFlowStore((s) => s.workbookId);
  const workbookVersionId = useMeasurementFlowStore((s) => s.workbookVersionId);
  const rehydrateFlowNodes = useMeasurementFlowStore((s) => s.rehydrateFlowNodes);

  const needsHydration = hasUnresolvedSnapshotCode(flowNodes);

  // suppressToast: the unavailable state below replaces the global error toast.
  const { data, error, isPaused } = useWorkbookVersionQuery(
    needsHydration ? workbookId : undefined,
    needsHydration ? workbookVersionId : undefined,
    { suppressToast: true },
  );

  const cells = data?.cells;

  useEffect(() => {
    if (!needsHydration || !cells) return;
    rehydrateFlowNodes(hydrateFlowNodes(flowNodes, cells, data?.entitySnapshots));
  }, [needsHydration, cells, data?.entitySnapshots, flowNodes, rehydrateFlowNodes]);

  if (!needsHydration) return { status: "ready" };

  // Unreachable for payloads this build wrote; report rather than hang.
  if (!workbookId || !workbookVersionId) {
    return { status: "unavailable", reason: "version-missing" };
  }

  // offlineFirst pauses rather than errors when nothing is cached.
  if (isPaused) return { status: "unavailable", reason: "offline" };
  if (error) {
    return {
      status: "unavailable",
      reason: errorStatus(error) === 404 ? "version-missing" : "error",
    };
  }

  // Data present but the effect has not written yet.
  return { status: "loading" };
}
