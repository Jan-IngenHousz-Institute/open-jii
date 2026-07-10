import { initContract } from "@ts-rest/core";

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
} from "../schemas/iot.schema";

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

  // --- IotDevice registry ---
  listIotDevices: {
    method: "GET",
    path: "/api/v1/devices",
    responses: {
      200: zIotDeviceList,
      401: zErrorResponse,
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
      404: zErrorResponse,
    },
    summary: "Delete a device",
    description: "Deletes the device registration and its AWS IoT Thing",
  },
});
