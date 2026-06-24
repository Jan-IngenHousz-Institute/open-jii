import { oc } from "@orpc/contract";
import { z } from "zod";

import {
  zCreateExperimentVisualizationBody,
  zCreateExperimentVisualizationResponse,
  zExperimentIdPathParam,
  zExperimentVisualization,
  zExperimentVisualizationList,
  zExperimentVisualizationPathParam,
  zListExperimentVisualizationsQuery,
  zUpdateExperimentVisualizationBody,
  zUpdateExperimentVisualizationResponse,
} from "./experiment.schema";

export const experimentVisualizationsOrpcContract = {
  listExperimentVisualizations: oc
    .route({ method: "GET", path: "/api/v1/experiments/{id}/visualizations", successStatus: 200 })
    .input(zExperimentIdPathParam.merge(zListExperimentVisualizationsQuery))
    .output(zExperimentVisualizationList),
  createExperimentVisualization: oc
    .route({ method: "POST", path: "/api/v1/experiments/{id}/visualizations", successStatus: 201 })
    .input(zExperimentIdPathParam.and(zCreateExperimentVisualizationBody))
    .output(zCreateExperimentVisualizationResponse),
  getExperimentVisualization: oc
    .route({
      method: "GET",
      path: "/api/v1/experiments/{id}/visualizations/{visualizationId}",
      successStatus: 200,
    })
    .input(zExperimentVisualizationPathParam)
    .output(zExperimentVisualization),
  updateExperimentVisualization: oc
    .route({
      method: "PATCH",
      path: "/api/v1/experiments/{id}/visualizations/{visualizationId}",
      successStatus: 200,
    })
    .input(zExperimentVisualizationPathParam.and(zUpdateExperimentVisualizationBody))
    .output(zUpdateExperimentVisualizationResponse),
  deleteExperimentVisualization: oc
    .route({
      method: "DELETE",
      path: "/api/v1/experiments/{id}/visualizations/{visualizationId}",
      successStatus: 204,
    })
    .input(zExperimentVisualizationPathParam)
    .output(z.void()),
};
