import type { IotDeviceGroupMonitoring } from "@repo/api/domains/iot/device-group/iot-device-group.schema";

export const GROUP_MONITORING_CACHE = Symbol("GROUP_MONITORING_CACHE");

export interface GroupMonitoringLoad {
  monitoring: IotDeviceGroupMonitoring;
  complete: boolean;
}

export interface GroupMonitoringCache {
  getOrLoad(
    key: string,
    load: () => Promise<GroupMonitoringLoad>,
  ): Promise<IotDeviceGroupMonitoring>;
}
