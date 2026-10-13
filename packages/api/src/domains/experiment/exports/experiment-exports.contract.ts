import { oc } from "@orpc/contract";

import { zExperimentIdPathParam } from "../experiment.schema";
import {
  zExperimentInitiateExportBody,
  zExperimentInitiateExportResponse,
  zExperimentListExportsQuery,
  zExperimentListExportsResponse,
} from "./experiment-exports.schema";

export const experimentExportsContract = {
  initiateExport: oc
    .route({ method: "POST", path: "/api/v1/experiments/{id}/data/exports", successStatus: 201 })
    .input(zExperimentIdPathParam.and(zExperimentInitiateExportBody))
    .output(zExperimentInitiateExportResponse),
  listExports: oc
    .route({ method: "GET", path: "/api/v1/experiments/{id}/data/exports", successStatus: 200 })
    .input(zExperimentIdPathParam.and(zExperimentListExportsQuery))
    .output(zExperimentListExportsResponse),
};
