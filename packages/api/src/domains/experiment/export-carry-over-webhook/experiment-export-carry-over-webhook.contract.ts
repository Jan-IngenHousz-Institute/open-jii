import { oc } from "@orpc/contract";

import {
  zExperimentExportCarryOverPayload,
  zExperimentExportCarryOverResponse,
} from "./experiment-export-carry-over-webhook.schema";

export const experimentExportCarryOverWebhookContract = {
  carryOverExports: oc
    .route({ method: "POST", path: "/api/v1/webhooks/data-export-carry-over", successStatus: 201 })
    .input(zExperimentExportCarryOverPayload)
    .output(zExperimentExportCarryOverResponse),
};
