import { oc } from "@orpc/contract";

import {
  zExperimentUploadWebhookPayload,
  zExperimentUploadWebhookResponse,
} from "./experiment-upload-webhook.schema";

export const experimentUploadWebhookContract = {
  uploadOutcome: oc
    .route({ method: "POST", path: "/api/v1/webhooks/data-upload", successStatus: 201 })
    .input(zExperimentUploadWebhookPayload)
    .output(zExperimentUploadWebhookResponse),
};
