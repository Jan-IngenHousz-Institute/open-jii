import { useEffect, useState } from "react";
import { hasUnresolvedSnapshotCode } from "~/features/measurement-flow/domain/flow-snapshots";
import { useFlowSnapshotsStore } from "~/features/measurement-flow/stores/use-flow-snapshots-store";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { hydrateFlowNodes } from "~/features/measurement-flow/utils/hydrate-flow-nodes";

export type ResumeHydrationState = "ready" | "loading" | "unavailable";

function useSnapshotsStoreHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useFlowSnapshotsStore.persist.hasHydrated());
  useEffect(() => {
    if (hydrated) return;
    // Subscribe before re-checking: onFinishHydration does not replay for late
    // subscribers, so hydration finishing between render and this effect would
    // otherwise leave the hook on "loading" for good.
    const unsubscribe = useFlowSnapshotsStore.persist.onFinishHydration(() => setHydrated(true));
    if (useFlowSnapshotsStore.persist.hasHydrated()) setHydrated(true);
    return unsubscribe;
  }, [hydrated]);
  return hydrated;
}

/**
 * Re-attaches protocol/macro snapshot code to a flow resumed from a cold start.
 * The persisted slice omits it and the picker (the only other hydration path)
 * never mounts on resume, so the code comes from the flow's own snapshots
 * store. MeasurementFlowContainer gates on the returned status.
 */
export function useResumeSnapshotHydration(): ResumeHydrationState {
  const flowNodes = useMeasurementFlowStore((s) => s.flowNodes);
  const cells = useMeasurementFlowStore((s) => s.cells);
  const workbookVersionId = useMeasurementFlowStore((s) => s.workbookVersionId);
  const rehydrateFlowNodes = useMeasurementFlowStore((s) => s.rehydrateFlowNodes);

  const snapshotsHydrated = useSnapshotsStoreHydrated();
  const storedVersionId = useFlowSnapshotsStore((s) => s.workbookVersionId);
  const storedSnapshots = useFlowSnapshotsStore((s) => s.entitySnapshots);

  const needsHydration = hasUnresolvedSnapshotCode(flowNodes);
  const hasStoredSnapshots =
    snapshotsHydrated && !!workbookVersionId && storedVersionId === workbookVersionId;

  useEffect(() => {
    if (!needsHydration || !hasStoredSnapshots) return;
    rehydrateFlowNodes(hydrateFlowNodes(flowNodes, cells, storedSnapshots));
  }, [needsHydration, hasStoredSnapshots, storedSnapshots, cells, flowNodes, rehydrateFlowNodes]);

  if (!needsHydration) return "ready";
  // Store still hydrating, or the effect has not written yet.
  if (!snapshotsHydrated || hasStoredSnapshots) return "loading";
  // Only reachable if the app died between the flow-store and snapshots-store
  // writes at flow start; the flow cannot run, so the container says so.
  return "unavailable";
}
