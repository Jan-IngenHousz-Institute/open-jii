import { oc } from "@orpc/contract";

import {
  zExperimentProjectTransferWebhookPayload,
  zExperimentProjectTransferWebhookResponse,
} from "../experiment.schema";

export const experimentProjectTransferWebhookContract = {
  projectTransfer: oc
    .route({ method: "POST", path: "/api/v1/webhooks/project-transfer", successStatus: 201 })
    .input(zExperimentProjectTransferWebhookPayload)
    .output(zExperimentProjectTransferWebhookResponse),
};
