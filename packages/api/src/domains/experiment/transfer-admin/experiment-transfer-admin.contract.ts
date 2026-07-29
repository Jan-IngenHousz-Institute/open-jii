import { oc } from "@orpc/contract";

import {
  zTransferExperimentAdminBody,
  zTransferExperimentAdminResponse,
} from "./experiment-transfer-admin.schema";

/**
 * Admin hand-off. Its own contract rather than part of the sharing routes because
 * it is a bulk, cross-experiment operation driven by the account-deletion flow,
 * and it is deliberately permitted on archived experiments.
 */
export const experimentTransferAdminContract = {
  transferExperimentAdmin: oc
    .route({ method: "POST", path: "/api/v1/experiments/transfer-admin", successStatus: 200 })
    .input(zTransferExperimentAdminBody)
    .output(zTransferExperimentAdminResponse),
};
