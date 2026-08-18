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
    orpc.experiments.listExperiments.key(),
  ],
  macro: () => [orpc.macros.getMacro.key(), orpc.macros.listMacros.key()],
  protocol: () => [orpc.protocols.getProtocol.key(), orpc.protocols.listProtocols.key()],
  workbook: () => [orpc.workbooks.getWorkbook.key(), orpc.workbooks.listWorkbooks.key()],
  device: () => [orpc.iot.getIotDevice.key(), orpc.iot.listIotDevices.key()],
  device_group: () => [
    orpc.deviceGroups.getDeviceGroup.key(),
    orpc.deviceGroups.listDeviceGroups.key(),
  ],
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
    case "device_group":
      return [
        orpc.deviceGroups.getDeviceGroup.queryKey({ input: { groupId: resourceId } }),
        orpc.deviceGroups.listDeviceGroups.key(),
      ];
  }
}
