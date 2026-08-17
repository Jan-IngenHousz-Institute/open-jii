import { z } from "zod";

import { zIotDevice } from "../../iot/iot.schema";

// A device bound to an experiment. Certificate and governance fields are
// deliberately omitted: experiment members see the devices serving their
// experiment, not the credential or org state of hardware they may not own.
export const zExperimentDevice = z.object({
  device: zIotDevice.pick({
    id: true,
    thingName: true,
    serialNumber: true,
    name: true,
    deviceType: true,
    status: true,
  }),
  addedBy: z.string().uuid(),
  addedAt: z.string().datetime(),
});

export const zExperimentDeviceList = z.array(zExperimentDevice);

export const zExperimentDevicePathParam = z.object({
  id: z.string().uuid().describe("ID of the experiment"),
  deviceId: z.string().uuid().describe("ID of the device"),
});

export type ExperimentDevice = z.infer<typeof zExperimentDevice>;
export type ExperimentDeviceList = z.infer<typeof zExperimentDeviceList>;
export type ExperimentDevicePathParam = z.infer<typeof zExperimentDevicePathParam>;
