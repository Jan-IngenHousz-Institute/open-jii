import { initContract } from "@ts-rest/core";

import {
  zDatabricksWebhookPayload,
  zWebhookSuccessResponse,
  zWebhookErrorResponse,
  zWebhookAuthHeader,
} from "../schemas/webhook.schema";

const c = initContract();

export const webhookContract = c.router({
  updateProvisioningStatus: {
    method: "POST",
    path: "/api/v1/webhooks/experiment/provisioning-status",
    body: zDatabricksWebhookPayload,
    headers: zWebhookAuthHeader,
    responses: {
      200: zWebhookSuccessResponse,
      400: zWebhookErrorResponse,
      401: zWebhookErrorResponse,
    },
    summary: "Handle experiment provisioning status updates",
    description:
      "Receives status updates from Databricks workflows and updates the corresponding experiment status",
  },
});
