import type { WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";
import type { EntitySnapshots } from "@repo/api/schemas/workbook-version.schema";

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
