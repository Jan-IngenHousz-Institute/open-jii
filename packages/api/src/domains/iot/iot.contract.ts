import { oc } from "@orpc/contract";
import { z } from "zod";

import {
  zDeviceExperimentList,
  zDeviceOnboardingConfig,
  zDeviceRegistryWebhookPayload,
  zDeviceRegistryWebhookResponse,
  zIotCredentials,
  zIotDevice,
  zIotDeviceList,
  zIotDevicePathParam,
  zIotUploadUrl,
  zIotUploadUrlRequest,
  zIssueIotCredentialsResponse,
  zOnboardDeviceBody,
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
  listIotDevices: oc
    .route({ method: "GET", path: "/api/v1/devices", successStatus: 200 })
    .output(zIotDeviceList),
  registerIotDevice: oc
    .route({ method: "POST", path: "/api/v1/devices", successStatus: 201 })
    .input(zRegisterIotDeviceBody)
    .output(zRegisterIotDeviceResponse),
  getIotDevice: oc
    .route({ method: "GET", path: "/api/v1/devices/{deviceId}", successStatus: 200 })
    .input(zIotDevicePathParam)
    .output(zIotDevice),
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
