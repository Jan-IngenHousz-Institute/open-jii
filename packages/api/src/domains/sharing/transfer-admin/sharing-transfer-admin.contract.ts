import { oc } from "@orpc/contract";

import {
  zTransferResourceAdminBody,
  zTransferResourceAdminResponse,
} from "./sharing-transfer-admin.schema";

/**
 * Admin hand-off. Its own contract rather than part of the per-resource sharing
 * routes because it is a bulk, cross-resource operation driven by the
 * account-deletion flow, and it is deliberately permitted on archived
 * experiments.
 */
export const sharingTransferAdminContract = {
  transferResourceAdmin: oc
    .route({ method: "POST", path: "/api/v1/collaborators/transfer-admin", successStatus: 200 })
    .input(zTransferResourceAdminBody)
    .output(zTransferResourceAdminResponse),
};
