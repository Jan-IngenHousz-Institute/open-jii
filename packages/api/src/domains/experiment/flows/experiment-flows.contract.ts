import { oc } from "@orpc/contract";

import { zExperimentIdPathParam } from "../experiment.schema";
import { zExperimentFlow, zExperimentFlowRouteInput } from "./experiment-flows.schema";

export const experimentFlowsContract = {
  getFlow: oc
    .route({ method: "GET", path: "/api/v1/experiments/{id}/flow", successStatus: 200 })
    .input(zExperimentIdPathParam)
    .output(zExperimentFlow),
  createFlow: oc
    .route({ method: "POST", path: "/api/v1/experiments/{id}/flow", successStatus: 201 })
    .input(zExperimentFlowRouteInput)
    .output(zExperimentFlow),
  updateFlow: oc
    .route({ method: "PUT", path: "/api/v1/experiments/{id}/flow", successStatus: 200 })
    .input(zExperimentFlowRouteInput)
    .output(zExperimentFlow),
};
