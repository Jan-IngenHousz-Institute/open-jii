import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { zErrorResponse } from "../schemas/experiment.schema";
import {
  zIotDevice,
  zIotDeviceList,
  zIotDevicePathParam,
  zIotCredentials,
  zIotUploadUrl,
  zIotUploadUrlRequest,
  zRegisterIotDeviceBody,
  zRegisterIotDeviceResponse,
  zIssueIotCredentialsResponse,
  zDeviceRegistryWebhookPayload,
  zDeviceRegistryWebhookResponse,
} from "../schemas/iot.schema";
import { zWebhookAuthHeader, zWebhookErrorResponse } from "../schemas/user.schema";

const c = initContract();

export const iotContract = c.router({
  getCredentials: {
    method: "GET",
    path: "/api/v1/iot/credentials",
    responses: {
      200: zIotCredentials,
      401: zErrorResponse,
      500: zErrorResponse,
    },
    summary: "Get IoT credentials",
    description:
      "Returns temporary AWS credentials for authenticated users to connect to AWS IoT Core. " +
      "Credentials are valid for 15 minutes. Requires active Better Auth session.",
  },
  getUploadUrl: {
    method: "POST",
    path: "/api/v1/iot/upload-url",
    body: zIotUploadUrlRequest,
    responses: {
      200: zIotUploadUrl,
      401: zErrorResponse,
      500: zErrorResponse,
    },
    summary: "Get pre-signed S3 upload URL for large IoT payloads",
    description:
      "Returns a pre-signed S3 PutObject URL for uploading IoT payloads larger than 128 KB. " +
      "The URL is valid for 15 minutes. Upload the JSON payload directly to the returned URL using HTTP PUT.",
  },

  // --- Device registry webhook (Databricks lineage) ---
  getDeviceRegistry: {
    method: "POST",
    path: "/api/v1/iot/devices/registry",
    body: zDeviceRegistryWebhookPayload,
    headers: zWebhookAuthHeader,
    responses: {
      200: zDeviceRegistryWebhookResponse,
      400: zWebhookErrorResponse,
      401: zWebhookErrorResponse,
    },
    summary: "Resolve thing names to registry rows for Databricks pipelines",
    description:
      "Resolves thing names to their registered device rows (id, serial, type, status, owner) so the lineage pipeline can join measurements to the registry.",
  },

  // --- IotDevice registry ---
  listIotDevices: {
    method: "GET",
    path: "/api/v1/devices",
    responses: {
      200: zIotDeviceList,
      401: zErrorResponse,
      403: zErrorResponse,
    },
    summary: "List devices",
    description: "Retrieves the IoT devices owned by the authenticated user",
  },

  registerIotDevice: {
    method: "POST",
    path: "/api/v1/devices",
    body: zRegisterIotDeviceBody,
    responses: {
      201: zRegisterIotDeviceResponse,
      400: zErrorResponse,
      401: zErrorResponse,
      403: zErrorResponse,
      409: zErrorResponse,
    },
    summary: "Register a device",
    description:
      "Registers a device as an AWS IoT Thing owned by the authenticated user. No certificate is issued at this stage.",
  },

  getIotDevice: {
    method: "GET",
    path: "/api/v1/devices/:deviceId",
    pathParams: zIotDevicePathParam,
    responses: {
      200: zIotDevice,
      401: zErrorResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Get a device",
    description: "Retrieves a specific device owned by the authenticated user",
  },

  deleteIotDevice: {
    method: "DELETE",
    path: "/api/v1/devices/:deviceId",
    pathParams: zIotDevicePathParam,
    responses: {
      204: null,
      401: zErrorResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Delete a device",
    description: "Deletes the device registration and its AWS IoT Thing",
  },

  issueIotCredentials: {
    method: "POST",
    path: "/api/v1/devices/:deviceId/credentials",
    pathParams: zIotDevicePathParam,
    body: z.object({}),
    responses: {
      201: zIssueIotCredentialsResponse,
      400: zErrorResponse,
      401: zErrorResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Issue device credentials",
    description:
      "Issues an X.509 certificate for a pending device, attaches it to the Thing, and activates the device. Returns the certificate PEM and private key once; they are never retrievable again.",
  },

  rotateIotCredentials: {
    method: "POST",
    path: "/api/v1/devices/:deviceId/credentials/rotate",
    pathParams: zIotDevicePathParam,
    body: z.object({}),
    responses: {
      201: zIssueIotCredentialsResponse,
      400: zErrorResponse,
      401: zErrorResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Rotate device credentials",
    description:
      "Issues a new certificate for an active device, retires the previous one, and returns the new certificate PEM and private key once.",
  },

  revokeIotCredentials: {
    method: "DELETE",
    path: "/api/v1/devices/:deviceId/credentials",
    pathParams: zIotDevicePathParam,
    responses: {
      200: zIotDevice,
      400: zErrorResponse,
      401: zErrorResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Revoke device credentials",
    description:
      "Revokes the device certificate and marks the device as revoked. The device can no longer connect.",
  },
});
