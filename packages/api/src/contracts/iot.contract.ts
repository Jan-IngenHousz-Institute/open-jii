import { initContract } from "@ts-rest/core";

import { zErrorResponse } from "../schemas/experiment.schema";
import { zIotCredentials } from "../schemas/iot.schema";

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
});
