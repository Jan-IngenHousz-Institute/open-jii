import { oc } from "@orpc/contract";
import { z } from "zod";

import {
  zCreateExperimentBody,
  zExperiment,
  zExperimentAccess,
  zExperimentFilterQuery,
  zExperimentIdPathParam,
  zExperimentList,
  zUpdateExperimentBody,
} from "./experiment.schema";

export const experimentCoreContract = {
  createExperiment: oc
    .route({ method: "POST", path: "/api/v1/experiments", successStatus: 201 })
    .input(zCreateExperimentBody)
    .output(zExperiment),
  listExperiments: oc
    .route({ method: "GET", path: "/api/v1/experiments", successStatus: 200 })
    .input(zExperimentFilterQuery)
    .output(zExperimentList),
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
  deleteExperiment: oc
    .route({ method: "DELETE", path: "/api/v1/experiments/{id}", successStatus: 204 })
    .input(zExperimentIdPathParam)
    .output(z.void()),
};
