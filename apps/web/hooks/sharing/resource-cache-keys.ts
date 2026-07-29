import { orpc } from "@/lib/orpc";
import type { QueryKey } from "@tanstack/react-query";

import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";

/**
 * The resource's *own* caches — the ones that decide whether the mounted detail
 * view keeps rendering. Dropped when a user gives up their own access (revoking
 * their own grant, or leaving), so the route re-reads from the server and its
 * normal access handling (404/403 → not-found or error) takes over instead of
 * leaving a stale page on screen.
 */
export function resourceCacheKeys(
  resourceType: SharingResourceType,
  resourceId: string,
): QueryKey[] {
  switch (resourceType) {
    case "experiment":
      return [
        orpc.experiments.getExperiment.queryKey({ input: { id: resourceId } }),
        orpc.experiments.getExperimentAccess.queryKey({ input: { id: resourceId } }),
        orpc.experiments.listExperiments.key(),
      ];
    case "macro":
      return [
        orpc.macros.getMacro.queryKey({ input: { id: resourceId } }),
        orpc.macros.listMacros.key(),
      ];
    case "protocol":
      return [
        orpc.protocols.getProtocol.queryKey({ input: { id: resourceId } }),
        orpc.protocols.listProtocols.key(),
      ];
    case "workbook":
      return [
        orpc.workbooks.getWorkbook.queryKey({ input: { id: resourceId } }),
        orpc.workbooks.listWorkbooks.key(),
      ];
  }
}
