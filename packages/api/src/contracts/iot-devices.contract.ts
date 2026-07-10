import { initContract } from "@ts-rest/core";

import { zErrorResponse } from "../schemas/experiment.schema";
import {
  zIotDevice,
  zProvisionDeviceRequest,
  zProvisionDeviceResponse,
  zRotateCertificateResponse,
} from "../schemas/iot-devices.schema";

const c = initContract();

export const iotDevicesContract = c.router({
  provision: {
    method: "POST",
    path: "/api/v1/iot-devices/provision",
    body: zProvisionDeviceRequest,
    responses: {
      201: zProvisionDeviceResponse,
      409: zErrorResponse,
      500: zErrorResponse,
    },
    summary: "Provision a new IoT device",
    description:
      "Creates an IoT Thing in AWS IoT Core, issues a unique X.509 certificate, and records the " +
      "device in the registry. Returns the certificate PEM and private key — store them on the device. " +
      "Called from the mobile app while the user is authenticated.",
  },
  list: {
    method: "GET",
    path: "/api/v1/iot-devices",
    responses: {
      200: zIotDevice.array(),
      401: zErrorResponse,
      500: zErrorResponse,
    },
    summary: "List all IoT devices",
  },
  get: {
    method: "GET",
    path: "/api/v1/iot-devices/:thingName",
    pathParams: c.type<{ thingName: string }>(),
    responses: {
      200: zIotDevice,
      401: zErrorResponse,
      404: zErrorResponse,
      500: zErrorResponse,
    },
    summary: "Get device by Thing name",
  },
  rotateCertificate: {
    method: "POST",
    path: "/api/v1/iot-devices/:thingName/rotate-certificate",
    pathParams: c.type<{ thingName: string }>(),
    body: c.type<Record<string, never>>(),
    responses: {
      200: zRotateCertificateResponse,
      401: zErrorResponse,
      404: zErrorResponse,
      500: zErrorResponse,
    },
    summary: "Rotate device certificate",
    description:
      "Issues a new certificate, attaches it to the Thing, deactivates the old certificate, " +
      "and updates the device registry. Returns the new certificate PEM — store it on the device.",
  },
  decommission: {
    method: "DELETE",
    path: "/api/v1/iot-devices/:thingName",
    pathParams: c.type<{ thingName: string }>(),
    responses: {
      200: zIotDevice,
      401: zErrorResponse,
      404: zErrorResponse,
      500: zErrorResponse,
    },
    summary: "Decommission device",
    description:
      "Revokes the device certificate in AWS IoT and marks the device as revoked in the registry. " +
      "The device will immediately be unable to connect.",
  },
});
