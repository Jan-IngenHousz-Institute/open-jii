import { useMemo } from "react";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";

import type { ProtocolCell } from "@repo/api/schemas/workbook-cells.schema";

/**
 * The protocol the scan runs, sourced from the workbook version's pinned
 * snapshot (code/family) plus the cell (name) held in the flow store. No
 * network: every experiment is workbook-backed, so the code is already cached
 * offline with the workbook version (see useLoadExperimentFlow).
 */
export function useProtocol(protocolId: string | undefined) {
  const snapshot = useMeasurementFlowStore((s) =>
    protocolId ? s.entitySnapshots?.protocols[protocolId] : undefined,
  );
  const name = useMeasurementFlowStore((s) => {
    if (!protocolId) return undefined;
    const cell = s.cells.find(
      (c): c is ProtocolCell => c.type === "protocol" && c.payload.protocolId === protocolId,
    );
    return cell?.payload.name;
  });

  const protocol = useMemo(
    () =>
      snapshot
        ? {
            code: (snapshot.code ?? []) as Record<string, unknown>[],
            family: snapshot.family,
            name,
          }
        : undefined,
    [snapshot, name],
  );

  return { protocol, isLoading: false, error: undefined };
}
