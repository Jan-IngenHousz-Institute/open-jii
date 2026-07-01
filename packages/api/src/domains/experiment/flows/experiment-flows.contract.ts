import { oc } from "@orpc/contract";

import {
  zExperimentFlow,
  zExperimentIdPathParam,
  zExperimentUpsertFlowBody,
} from "../experiment.schema";

export const experimentFlowsContract = {
  getFlow: oc
    .route({ method: "GET", path: "/api/v1/experiments/{id}/flow", successStatus: 200 })
    .input(zExperimentIdPathParam)
    .output(zExperimentFlow),
  createFlow: oc
    .route({ method: "POST", path: "/api/v1/experiments/{id}/flow", successStatus: 201 })
    .input(zExperimentIdPathParam.and(zExperimentUpsertFlowBody))
    .output(zExperimentFlow),
  updateFlow: oc
    .route({ method: "PUT", path: "/api/v1/experiments/{id}/flow", successStatus: 200 })
    .input(zExperimentIdPathParam.and(zExperimentUpsertFlowBody))
    .output(zExperimentFlow),
};
