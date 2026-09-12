import { oc } from "@orpc/contract";
import { z } from "zod";

import { zExperimentIdPathParam } from "../experiment.schema";
import {
  zExperimentDevicePathParam,
  zExperimentDeviceSeries,
  zExperimentDeviceSeriesQuery,
  zExperimentDevicesOverview,
} from "./experiment-devices.schema";

export const experimentDevicesContract = {
  listExperimentDevices: oc
    .route({ method: "GET", path: "/api/v1/experiments/{id}/devices", successStatus: 200 })
    .input(zExperimentIdPathParam)
    .output(zExperimentDevicesOverview),
  getExperimentDeviceSeries: oc
    .route({ method: "GET", path: "/api/v1/experiments/{id}/device-series", successStatus: 200 })
    .input(zExperimentDeviceSeriesQuery)
    .output(zExperimentDeviceSeries),
  removeExperimentDevice: oc
    .route({
      method: "DELETE",
      path: "/api/v1/experiments/{id}/devices/{deviceId}",
      successStatus: 204,
    })
    .input(zExperimentDevicePathParam)
    .output(z.void()),
};
