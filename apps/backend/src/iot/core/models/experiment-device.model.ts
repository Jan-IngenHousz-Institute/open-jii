import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import type { EntitySnapshots } from "@repo/api/domains/workbook/workbook-version.schema";

import type { ExperimentDto } from "../../../experiments/core/models/experiment.model";
import type { IotDeviceDto } from "./iot-device.model";

// A device bound to an experiment. Certificate state is deliberately absent: an
// experiment member may see a device they do not own.
export interface ExperimentDeviceDto {
  device: Pick<
    IotDeviceDto,
    "id" | "thingName" | "serialNumber" | "name" | "deviceType" | "status"
  >;
  addedBy: string;
  addedAt: Date;
}

// One device on the experiment's Devices tab: bound, observed publishing into
// the experiment, or both. `device` is null for a publisher with no registry row.
export interface ExperimentDeviceEntryDto {
  device: ExperimentDeviceDto["device"] | null;
  clientId: string;
  binding: { addedBy: string; addedAt: Date } | null;
  connectivity: { connected: boolean; lastSeenAt: string | null } | null;
  lastDataAt: string | null;
  recentData: { measurementCount: number; lastDataAt: string | null } | null;
  canView: boolean;
}

export interface ExperimentDevicesOverviewDto {
  devices: ExperimentDeviceEntryDto[];
  window: { from: string; to: string };
  pipelineUnavailable: boolean;
}

// An experiment a device serves, for the device-detail view.
export type DeviceExperimentDto = Pick<ExperimentDto, "id" | "name" | "status"> & {
  addedAt: Date;
};

// One bound experiment plus the procedure the device runs for it: the pinned
// workbook version, or null when the experiment has none.
export interface DeviceOnboardingExperimentDto {
  experimentId: string;
  experimentName: string;
  workbook: {
    version: number;
    cells: WorkbookCell[];
    entitySnapshots: EntitySnapshots;
  } | null;
}
