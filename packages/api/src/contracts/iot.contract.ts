import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { zErrorResponse } from "../schemas/experiment.schema";

const c = initContract();

// IoT Credentials Response Schema
export const zIoTCredentials = z.object({
  accessKeyId: z.string().describe("AWS Access Key ID for temporary credentials"),
  secretAccessKey: z.string().describe("AWS Secret Access Key for temporary credentials"),
  sessionToken: z.string().describe("AWS Session Token for temporary credentials"),
  expiration: z.string().datetime().describe("ISO 8601 date string when credentials expire"),
});

export const iotContract = c.router({
  getCredentials: {
    method: "POST",
    path: "/api/v1/iot/credentials",
    body: z.object({}), // Empty body, authentication comes from session
    responses: {
      200: zIoTCredentials,
      401: zErrorResponse, // Unauthorized - no session
      500: zErrorResponse, // Server error - Cognito failure
    },
    summary: "Get IoT credentials",
    description:
      "Returns temporary AWS credentials for authenticated users to connect to AWS IoT Core. " +
      "Credentials are valid for 15 minutes. Requires active Better Auth session.",
  },
});
