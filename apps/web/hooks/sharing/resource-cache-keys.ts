import { listQueryKeys } from "@/hooks/list-query-keys";
import { orpc } from "@/lib/orpc";
import type { QueryKey } from "@tanstack/react-query";

import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";

/**
 * Detail caches carry private content and caller capabilities but are not
 * principal-scoped, so sign-out must remove them before another user signs in.
 * The total record makes a newly shareable type fail compilation until included.
 */
const RESOURCE_CACHE_FAMILIES: Record<SharingResourceType, () => QueryKey[]> = {
  experiment: () => [
    orpc.experiments.getExperiment.key(),
    orpc.experiments.getExperimentAccess.key(),
    ...listQueryKeys.experiments(),
  ],
  macro: () => [orpc.macros.getMacro.key(), ...listQueryKeys.macros()],
  protocol: () => [orpc.protocols.getProtocol.key(), ...listQueryKeys.protocols()],
  workbook: () => [orpc.workbooks.getWorkbook.key(), ...listQueryKeys.workbooks()],
  device: () => [orpc.iot.getIotDevice.key(), orpc.iot.listIotDevices.key()],
  device_group: () => [orpc.iot.getIotDeviceGroup.key(), orpc.iot.listIotDeviceGroups.key()],
};

export function allResourceCacheFamilies(): QueryKey[] {
  return Object.values(RESOURCE_CACHE_FAMILIES).flatMap((families) => families());
}

/**
 * Re-read the affected detail and list after self-revoke/leave so a stale private
 * page cannot remain mounted. Resource-specific keys avoid refreshing its peers.
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
        ...listQueryKeys.experiments(),
      ];
    case "macro":
      return [
        orpc.macros.getMacro.queryKey({ input: { id: resourceId } }),
        ...listQueryKeys.macros(),
      ];
    case "protocol":
      return [
        orpc.protocols.getProtocol.queryKey({ input: { id: resourceId } }),
        ...listQueryKeys.protocols(),
      ];
    case "workbook":
      return [
        orpc.workbooks.getWorkbook.queryKey({ input: { id: resourceId } }),
        ...listQueryKeys.workbooks(),
      ];
    case "device":
      return [
        orpc.iot.getIotDevice.queryKey({ input: { deviceId: resourceId } }),
        orpc.iot.listIotDevices.key(),
      ];
    case "device_group":
      return [
        orpc.iot.getIotDeviceGroup.queryKey({ input: { groupId: resourceId } }),
        orpc.iot.listIotDeviceGroups.key(),
      ];
  }
}
