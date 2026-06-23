import { initContract } from "@ts-rest/core";

import { zErrorResponse } from "../../shared/errors";
import { zIotCredentials, zIotUploadUrl, zIotUploadUrlRequest } from "./iot.schema";

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
});
