import { oc } from "@orpc/contract";
import { z } from "zod";

import { zExperimentIdPathParam } from "../experiment.schema";
import {
  zCreateJoinCodeBody,
  zExperimentJoinCode,
  zExperimentJoinCodeResponse,
  zJoinCodePathParam,
  zJoinCodePreview,
  zRedeemJoinCodeResponse,
} from "./experiment-join-codes.schema";

/**
 * Organizer routes hang off the experiment; the two joiner routes deliberately do
 * not. A literal segment inside another domain's `/{id}` collection resolves by
 * module import order, and the joiner holds a code, not an experiment id.
 */
export const experimentJoinCodesContract = {
  getJoinCode: oc
    .route({ method: "GET", path: "/api/v1/experiments/{id}/join-code", successStatus: 200 })
    .input(zExperimentIdPathParam)
    .output(zExperimentJoinCodeResponse),
  createJoinCode: oc
    .route({ method: "POST", path: "/api/v1/experiments/{id}/join-code", successStatus: 201 })
    .input(zExperimentIdPathParam.and(zCreateJoinCodeBody))
    .output(zExperimentJoinCode),
  // 204 whether or not anything was active: revoking twice is not an error.
  revokeJoinCode: oc
    .route({ method: "DELETE", path: "/api/v1/experiments/{id}/join-code", successStatus: 204 })
    .input(zExperimentIdPathParam)
    .output(z.void()),
  resolveJoinCode: oc
    .route({ method: "GET", path: "/api/v1/experiment-join-codes/{code}", successStatus: 200 })
    .input(zJoinCodePathParam)
    .output(zJoinCodePreview),
  redeemJoinCode: oc
    .route({
      method: "POST",
      path: "/api/v1/experiment-join-codes/{code}/redeem",
      successStatus: 200,
    })
    .input(zJoinCodePathParam)
    .output(zRedeemJoinCodeResponse),
};
