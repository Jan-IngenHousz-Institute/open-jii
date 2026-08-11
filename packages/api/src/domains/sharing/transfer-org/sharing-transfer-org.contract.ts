import { oc } from "@orpc/contract";

import {
  zTransferResourceBody,
  zTransferResourcePathParams,
  zTransferResourceResponse,
} from "./sharing-transfer-org.schema";

/**
 * Move a resource from one organization to another — the release valve for the
 * rule that an organization cannot be deleted while it still owns anything, and
 * the only way out for a resource stranded in an organization whose owners are all
 * gone.
 *
 * Its own contract rather than part of the collaborator routes: this is not a
 * grant operation, and its resource-type set is narrower (no devices).
 * Authorization is inside the use-case — owner/admin of the source organization
 * plus membership of the target, with a grant-holder admitted only when the source
 * organization has no living owner left.
 *
 * There is no acceptance handshake on the target side: transferring in is treated
 * like creating in, which any member may already do.
 */
export const sharingTransferOrgContract = {
  transferResourceOrganization: oc
    .route({
      method: "POST",
      path: "/api/v1/{resourceType}/{id}/transfer",
      successStatus: 200,
    })
    .input(zTransferResourcePathParams.merge(zTransferResourceBody))
    .output(zTransferResourceResponse),
};
