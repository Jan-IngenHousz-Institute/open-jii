import { oc } from "@orpc/contract";
import { z } from "zod";

import { zIotDevicePathParam } from "../iot.schema";
import {
  zCalibrationDefinition,
  zCalibrationDefinitionList,
  zCalibrationDefinitionPathParam,
  zCalibrationRun,
  zCalibrationRunList,
  zCalibrationRunPathParam,
  zCreateCalibrationDefinitionBody,
  zCreateCalibrationRunBody,
  zCreateExternalCalibrationRunBody,
  zDeviceCalibration,
  zDeviceCalibrationList,
  zListCalibrationDefinitionsQuery,
  zReportDeviceCalibrationWriteBody,
} from "./iot-calibration.schema";

export const iotCalibrationContract = {
  // Definitions: the versioned recipes. A new version of an existing
  // (family, name) pair is created through the same create endpoint.
  listCalibrationDefinitions: oc
    .route({ method: "GET", path: "/api/v1/calibration-definitions", successStatus: 200 })
    .input(zListCalibrationDefinitionsQuery)
    .output(zCalibrationDefinitionList),
  getCalibrationDefinition: oc
    .route({
      method: "GET",
      path: "/api/v1/calibration-definitions/{definitionId}",
      successStatus: 200,
    })
    .input(zCalibrationDefinitionPathParam)
    .output(zCalibrationDefinition),
  createCalibrationDefinition: oc
    .route({ method: "POST", path: "/api/v1/calibration-definitions", successStatus: 201 })
    .input(zCreateCalibrationDefinitionBody)
    .output(zCalibrationDefinition),
  deleteCalibrationDefinition: oc
    .route({
      method: "DELETE",
      path: "/api/v1/calibration-definitions/{definitionId}",
      successStatus: 204,
    })
    .input(zCalibrationDefinitionPathParam)
    .output(z.void()),

  // Runs. The bench wizard submits the captured payload and the backend runs
  // the script synchronously; a bench tool submits blocks it computed itself.
  createCalibrationRun: oc
    .route({
      method: "POST",
      path: "/api/v1/devices/{deviceId}/calibration-runs",
      successStatus: 201,
    })
    .input(zCreateCalibrationRunBody)
    .output(zCalibrationRun),
  createExternalCalibrationRun: oc
    .route({
      method: "POST",
      path: "/api/v1/devices/{deviceId}/calibration-runs/external",
      successStatus: 201,
    })
    .input(zCreateExternalCalibrationRunBody)
    .output(zCalibrationRun),
  listDeviceCalibrationRuns: oc
    .route({
      method: "GET",
      path: "/api/v1/devices/{deviceId}/calibration-runs",
      successStatus: 200,
    })
    .input(zIotDevicePathParam)
    .output(zCalibrationRunList),
  getCalibrationRun: oc
    .route({ method: "GET", path: "/api/v1/calibration-runs/{runId}", successStatus: 200 })
    .input(zCalibrationRunPathParam)
    .output(zCalibrationRun),

  // Review. Approval supersedes the previous active calibration and creates
  // the applied row; rejection is terminal and keeps the diagnostics.
  approveCalibrationRun: oc
    .route({ method: "POST", path: "/api/v1/calibration-runs/{runId}/approve", successStatus: 201 })
    .input(zCalibrationRunPathParam)
    .output(zDeviceCalibration),
  rejectCalibrationRun: oc
    .route({ method: "POST", path: "/api/v1/calibration-runs/{runId}/reject", successStatus: 200 })
    .input(zCalibrationRunPathParam)
    .output(zCalibrationRun),

  // Applied calibrations.
  getActiveDeviceCalibration: oc
    .route({ method: "GET", path: "/api/v1/devices/{deviceId}/calibration", successStatus: 200 })
    .input(zIotDevicePathParam)
    .output(zDeviceCalibration.nullable()),
  listDeviceCalibrations: oc
    .route({ method: "GET", path: "/api/v1/devices/{deviceId}/calibrations", successStatus: 200 })
    .input(zIotDevicePathParam)
    .output(zDeviceCalibrationList),
  // The wizard reports the write-back it performed over the open connection,
  // addressed to the applied row it wrote (returned by approve).
  reportDeviceCalibrationWrite: oc
    .route({
      method: "POST",
      path: "/api/v1/device-calibrations/{calibrationId}/written",
      successStatus: 200,
    })
    .input(zReportDeviceCalibrationWriteBody)
    .output(zDeviceCalibration),
};
