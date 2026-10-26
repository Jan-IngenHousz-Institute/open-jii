import { oc } from "@orpc/contract";
import { z } from "zod";

import { zExperimentIdPathParam } from "../experiment.schema";
import {
  zExperimentLayout,
  zExperimentLayoutPlot,
  zExperimentLayoutPlotPathParam,
  zLayoutAnchor,
  zDeviceSensorList,
  zLayoutAttributes,
  zLayoutPlacement,
  zLayoutPlacementList,
  zLayoutPlacementListQuery,
  zLayoutSheetPreview,
  zLayoutSheetPreviewBody,
  zLayoutTermSearchQuery,
  zLayoutTermSearchResponse,
} from "./experiment-layout.schema";

export const experimentLayoutContract = {
  getExperimentLayout: oc
    .route({ method: "GET", path: "/api/v1/experiments/{id}/layout", successStatus: 200 })
    .input(zExperimentIdPathParam)
    .output(zExperimentLayout.nullable()),
  getExperimentLayoutPlot: oc
    .route({
      method: "GET",
      path: "/api/v1/experiments/{id}/layout/plots/{plotId}",
      successStatus: 200,
    })
    .input(zExperimentLayoutPlotPathParam)
    .output(zExperimentLayoutPlot),
  getExperimentLayoutAttributes: oc
    .route({
      method: "GET",
      path: "/api/v1/experiments/{id}/layout/attributes",
      successStatus: 200,
    })
    .input(zExperimentIdPathParam)
    .output(zLayoutAttributes),
  listLayoutPlacements: oc
    .route({
      method: "GET",
      path: "/api/v1/experiments/{id}/layout/placements",
      successStatus: 200,
    })
    .input(zExperimentIdPathParam.merge(zLayoutPlacementListQuery))
    .output(zLayoutPlacementList),
  listDeviceSensors: oc
    .route({
      method: "GET",
      path: "/api/v1/experiments/{id}/devices/{deviceId}/sensors",
      successStatus: 200,
    })
    .input(zExperimentIdPathParam.merge(z.object({ deviceId: z.string().uuid() })))
    .output(zDeviceSensorList),
  updateExperimentLayoutAnchor: oc
    .route({ method: "PUT", path: "/api/v1/experiments/{id}/layout/anchor", successStatus: 200 })
    .input(zExperimentIdPathParam.merge(zLayoutAnchor))
    .output(zLayoutAnchor),
  previewLayoutSheetMatch: oc
    .route({
      method: "POST",
      path: "/api/v1/experiments/{id}/layout/sheet-preview",
      successStatus: 200,
    })
    .input(zExperimentIdPathParam.merge(zLayoutSheetPreviewBody))
    .output(zLayoutSheetPreview),
  createLayoutPlacement: oc
    .route({
      method: "POST",
      path: "/api/v1/experiments/{id}/layout/placements",
      successStatus: 201,
    })
    .input(zExperimentIdPathParam.merge(zLayoutPlacement.omit({ id: true })))
    .output(zLayoutPlacement),
  searchLayoutTerms: oc
    .route({ method: "GET", path: "/api/v1/layout/terms/search", successStatus: 200 })
    .input(zLayoutTermSearchQuery)
    .output(zLayoutTermSearchResponse),
};
