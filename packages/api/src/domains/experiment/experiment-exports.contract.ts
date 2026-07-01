import { oc } from "@orpc/contract";
import { z } from "zod";

import {
  zExperimentInitiateExportBody,
  zExperimentInitiateExportResponse,
  zExperimentListExportsQuery,
  zExperimentListExportsResponse,
} from "./experiment-exports.schema";
import { zExperimentExportPathParam, zExperimentIdPathParam } from "./experiment.schema";

export const experimentExportsContract = {
  initiateExport: oc
    .route({ method: "POST", path: "/api/v1/experiments/{id}/data/exports", successStatus: 201 })
    .input(zExperimentIdPathParam.and(zExperimentInitiateExportBody))
    .output(zExperimentInitiateExportResponse),
  listExports: oc
    .route({ method: "GET", path: "/api/v1/experiments/{id}/data/exports", successStatus: 200 })
    .input(zExperimentIdPathParam.and(zExperimentListExportsQuery))
    .output(zExperimentListExportsResponse),
  downloadExport: oc
    .route({
      method: "GET",
      path: "/api/v1/experiments/{id}/data/exports/{exportId}",
      successStatus: 200,
    })
    .input(zExperimentExportPathParam)
    .output(z.instanceof(File)),
};
