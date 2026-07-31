import { orpc } from "@/lib/orpc";
import type { QueryKey } from "@tanstack/react-query";

import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";

/**
 * Every cache family that can hold a shareable resource's content or the caller's
 * own capabilities on it, one entry per {@link SharingResourceType}.
 *
 * Unlike the sharing and access queries, these keys are **not** principal-scoped:
 * a detail response is keyed by the resource alone, even though it carries private
 * content and a per-caller `capabilities` block. That is fine while one person is
 * signed in and dangerous the moment they are not, which is why sign-out drops all
 * of them — see `useSignOut`.
 *
 * Typed as a total `Record` deliberately: a type added to the sharing enum fails to
 * compile until its caches are named here, rather than silently surviving sign-out.
 */
const RESOURCE_CACHE_FAMILIES: Record<SharingResourceType, () => QueryKey[]> = {
  experiment: () => [
    orpc.experiments.getExperiment.key(),
    orpc.experiments.getExperimentAccess.key(),
    orpc.experiments.listExperiments.key(),
  ],
  macro: () => [orpc.macros.getMacro.key(), orpc.macros.listMacros.key()],
  protocol: () => [orpc.protocols.getProtocol.key(), orpc.protocols.listProtocols.key()],
  workbook: () => [orpc.workbooks.getWorkbook.key(), orpc.workbooks.listWorkbooks.key()],
  device: () => [orpc.iot.getIotDevice.key(), orpc.iot.listIotDevices.key()],
};

/** Every shareable resource's cache families, flattened. */
export function allResourceCacheFamilies(): QueryKey[] {
  return Object.values(RESOURCE_CACHE_FAMILIES).flatMap((families) => families());
}

/**
 * The resource's *own* caches — the ones that decide whether the mounted detail
 * view keeps rendering. Dropped when a user gives up their own access (revoking
 * their own grant, or leaving), so the route re-reads from the server and its
 * normal access handling (404/403 → not-found or error) takes over instead of
 * leaving a stale page on screen.
 *
 * Keyed down to the resource, not to its family: giving up access to one macro
 * says nothing about the others, so only this one is re-read.
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
    case "device":
      return [
        orpc.iot.getIotDevice.queryKey({ input: { deviceId: resourceId } }),
        orpc.iot.listIotDevices.key(),
      ];
  }
}
