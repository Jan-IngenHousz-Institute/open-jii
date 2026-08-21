import { oc } from "@orpc/contract";
import { z } from "zod";

import {
  zDeviceExperimentList,
  zDeviceFirmwareHistory,
  zDeviceMonitoring,
  zDeviceOnboardingConfig,
  zDeviceRegistryWebhookPayload,
  zDeviceRegistryWebhookResponse,
  zIotCredentials,
  zIotDevice,
  zIotDeviceActivity,
  zIotDeviceDetail,
  zMonitoringRangeQuery,
  zIotDeviceList,
  zIotDevicePathParam,
  zIotUploadUrl,
  zEnsureMobileDeviceBody,
  zIotUploadUrlRequest,
  zIssueIotCredentialsResponse,
  zOnboardDeviceBody,
  zBulkRegisterIotDevicesBody,
  zBulkRegisterIotDevicesResult,
  zRegisterIotDeviceBody,
  zRegisterIotDeviceResponse,
} from "./iot.schema";

export const iotContract = {
  getCredentials: oc
    .route({ method: "GET", path: "/api/v1/iot/credentials", successStatus: 200 })
    .output(zIotCredentials),
  getUploadUrl: oc
    .route({ method: "POST", path: "/api/v1/iot/upload-url", successStatus: 200 })
    .input(zIotUploadUrlRequest)
    .output(zIotUploadUrl),

  // Device registry webhook (Databricks lineage). Authenticated by HmacGuard.
  getDeviceRegistry: oc
    .route({ method: "POST", path: "/api/v1/iot/devices/registry", successStatus: 200 })
    .input(zDeviceRegistryWebhookPayload)
    .output(zDeviceRegistryWebhookResponse),

  // IotDevice registry (owner-scoped)
  // Idempotent per-phone self-registration; 200 whether the row was created
  // or already existed. The path is static, so it cannot collide with the
  // {deviceId} param routes.
  ensureMobileDevice: oc
    .route({ method: "POST", path: "/api/v1/devices/mobile", successStatus: 200 })
    .input(zEnsureMobileDeviceBody)
    .output(zIotDevice),
  listIotDevices: oc
    .route({ method: "GET", path: "/api/v1/devices", successStatus: 200 })
    .output(zIotDeviceList),
  registerIotDevice: oc
    .route({ method: "POST", path: "/api/v1/devices", successStatus: 201 })
    .input(zRegisterIotDeviceBody)
    .output(zRegisterIotDeviceResponse),
  bulkRegisterIotDevices: oc
    .route({ method: "POST", path: "/api/v1/devices/bulk", successStatus: 200 })
    .input(zBulkRegisterIotDevicesBody)
    .output(zBulkRegisterIotDevicesResult),
  getIotDevice: oc
    .route({ method: "GET", path: "/api/v1/devices/{deviceId}", successStatus: 200 })
    .input(zIotDevicePathParam)
    .output(zIotDeviceDetail),
  // Pipeline-computed last data arrival; served apart from the device detail so
  // list/detail never wait on the SQL warehouse.
  getIotDeviceActivity: oc
    .route({ method: "GET", path: "/api/v1/devices/{deviceId}/activity", successStatus: 200 })
    .input(zIotDevicePathParam)
    .output(zIotDeviceActivity),
  // One warehouse scan for the reported version, split out of the monitoring
  // fan-out so a caller that only needs firmware does not pay for sessions,
  // throughput, battery and measurements too.
  getDeviceFirmwareHistory: oc
    .route({
      method: "GET",
      path: "/api/v1/devices/{deviceId}/firmware-history",
      successStatus: 200,
    })
    .input(zMonitoringRangeQuery)
    .output(zDeviceFirmwareHistory),
  // Monitoring dashboard data (warehouse-backed, range-scoped): one call per
  // range change. Unlike the tile endpoints this fails loudly; the dashboard
  // owns the error state.
  getDeviceMonitoring: oc
    .route({
      method: "GET",
      path: "/api/v1/devices/{deviceId}/monitoring",
      successStatus: 200,
    })
    .input(zMonitoringRangeQuery)
    .output(zDeviceMonitoring),
  deleteIotDevice: oc
    .route({ method: "DELETE", path: "/api/v1/devices/{deviceId}", successStatus: 204 })
    .input(zIotDevicePathParam)
    .output(z.void()),
  issueIotCredentials: oc
    .route({ method: "POST", path: "/api/v1/devices/{deviceId}/credentials", successStatus: 201 })
    .input(zIotDevicePathParam)
    .output(zIssueIotCredentialsResponse),
  rotateIotCredentials: oc
    .route({
      method: "POST",
      path: "/api/v1/devices/{deviceId}/credentials/rotate",
      successStatus: 201,
    })
    .input(zIotDevicePathParam)
    .output(zIssueIotCredentialsResponse),
  revokeIotCredentials: oc
    .route({ method: "DELETE", path: "/api/v1/devices/{deviceId}/credentials", successStatus: 200 })
    .input(zIotDevicePathParam)
    .output(zIotDevice),

  // Onboarding: bind the device to experiments and return the config to hand
  // to the hardware. An empty body re-issues the config without new bindings.
  onboardDevice: oc
    .route({ method: "POST", path: "/api/v1/devices/{deviceId}/onboard", successStatus: 200 })
    .input(zIotDevicePathParam.merge(zOnboardDeviceBody))
    .output(zDeviceOnboardingConfig),
  listDeviceExperiments: oc
    .route({ method: "GET", path: "/api/v1/devices/{deviceId}/experiments", successStatus: 200 })
    .input(zIotDevicePathParam)
    .output(zDeviceExperimentList),
};
