import { oc } from "@orpc/contract";
import { z } from "zod";

import { zSetVisibilityBody, zSetVisibilityResponse } from "../visibility/visibility.schema";
import {
  zCreateExperimentBody,
  zExperiment,
  zExperimentAccess,
  zExperimentFilterQuery,
  zExperimentIdPathParam,
  zExperimentList,
  zExperimentPaginatedList,
  zExperimentPaginatedQuery,
  zUpdateExperimentBody,
} from "./experiment.schema";

export const experimentContract = {
  createExperiment: oc
    .route({ method: "POST", path: "/api/v1/experiments", successStatus: 201 })
    .input(zCreateExperimentBody)
    .output(zExperiment),
  listExperiments: oc
    .route({ method: "GET", path: "/api/v1/experiments", successStatus: 200 })
    .input(zExperimentFilterQuery)
    .output(zExperimentList),
  listExperimentsPaginated: oc
    .route({ method: "GET", path: "/api/v1/experiments/paginated", successStatus: 200 })
    .input(zExperimentPaginatedQuery)
    .output(zExperimentPaginatedList),
  getExperiment: oc
    .route({ method: "GET", path: "/api/v1/experiments/{id}", successStatus: 200 })
    .input(zExperimentIdPathParam)
    .output(zExperiment),
  getExperimentAccess: oc
    .route({ method: "GET", path: "/api/v1/experiments/{id}/access", successStatus: 200 })
    .input(zExperimentIdPathParam)
    .output(zExperimentAccess),
  updateExperiment: oc
    .route({ method: "PATCH", path: "/api/v1/experiments/{id}", successStatus: 200 })
    .input(zExperimentIdPathParam.and(zUpdateExperimentBody))
    .output(zExperiment),
  // Publish (monotonic private→public, gated on `manage`). Separate from the
  // general update so it can be a deliberate, one-way action.
  setVisibility: oc
    .route({ method: "PATCH", path: "/api/v1/experiments/{id}/visibility", successStatus: 200 })
    .input(zExperimentIdPathParam.merge(zSetVisibilityBody))
    .output(zSetVisibilityResponse),
  deleteExperiment: oc
    .route({ method: "DELETE", path: "/api/v1/experiments/{id}", successStatus: 204 })
    .input(zExperimentIdPathParam)
    .output(z.void()),
};
