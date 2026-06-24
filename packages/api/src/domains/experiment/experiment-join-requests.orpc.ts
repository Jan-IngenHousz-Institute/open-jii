import { oc } from "@orpc/contract";
import { z } from "zod";

import {
  zExperimentCreateJoinRequestBody,
  zExperimentIdPathParam,
  zExperimentJoinRequest,
  zExperimentJoinRequestList,
  zExperimentJoinRequestPathParam,
} from "./experiment.schema";

export const experimentJoinRequestsOrpcContract = {
  // A new request returns 201; a duplicate submit returns the existing pending
  // request (idempotent) with the same fixed status.
  createJoinRequest: oc
    .route({ method: "POST", path: "/api/v1/experiments/{id}/join-requests", successStatus: 201 })
    .input(zExperimentIdPathParam.and(zExperimentCreateJoinRequestBody))
    .output(zExperimentJoinRequest),
  listJoinRequests: oc
    .route({ method: "GET", path: "/api/v1/experiments/{id}/join-requests", successStatus: 200 })
    .input(zExperimentIdPathParam)
    .output(zExperimentJoinRequestList),
  getMyJoinRequest: oc
    .route({ method: "GET", path: "/api/v1/experiments/{id}/join-requests/me", successStatus: 200 })
    .input(zExperimentIdPathParam)
    .output(zExperimentJoinRequest),
  approveJoinRequest: oc
    .route({
      method: "POST",
      path: "/api/v1/experiments/{id}/join-requests/{requestId}/approve",
      successStatus: 200,
    })
    .input(zExperimentJoinRequestPathParam)
    .output(zExperimentJoinRequest),
  rejectJoinRequest: oc
    .route({
      method: "POST",
      path: "/api/v1/experiments/{id}/join-requests/{requestId}/reject",
      successStatus: 200,
    })
    .input(zExperimentJoinRequestPathParam)
    .output(zExperimentJoinRequest),
  cancelJoinRequest: oc
    .route({
      method: "DELETE",
      path: "/api/v1/experiments/{id}/join-requests/{requestId}",
      successStatus: 204,
    })
    .input(zExperimentJoinRequestPathParam)
    .output(z.void()),
};
