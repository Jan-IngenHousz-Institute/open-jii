import { oc } from "@orpc/contract";

import {
  zExperimentCreateTransferRequestBody,
  zExperimentTransferRequest,
  zExperimentTransferRequestList,
} from "./experiment-transfer-requests.schema";

export const experimentTransferRequestsContract = {
  createTransferRequest: oc
    .route({ method: "POST", path: "/api/v1/transfer-requests", successStatus: 201 })
    .input(zExperimentCreateTransferRequestBody)
    .output(zExperimentTransferRequest),
  listTransferRequests: oc
    .route({ method: "GET", path: "/api/v1/transfer-requests", successStatus: 200 })
    .output(zExperimentTransferRequestList),
};
