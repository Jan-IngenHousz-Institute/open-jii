import { oc } from "@orpc/contract";

import { zExperimentIdPathParam } from "../experiment.schema";
import {
  zExperimentDataQuery,
  zExperimentDataResponse,
  zExperimentDistinctValuesQuery,
  zExperimentDistinctValuesResponse,
  zExperimentTablesMetadataList,
} from "./experiment-data.schema";

export const experimentDataContract = {
  getExperimentTables: oc
    .route({ method: "GET", path: "/api/v1/experiments/{id}/tables", successStatus: 200 })
    .input(zExperimentIdPathParam)
    .output(zExperimentTablesMetadataList),
  getExperimentData: oc
    .route({ method: "GET", path: "/api/v1/experiments/{id}/data", successStatus: 200 })
    .input(zExperimentIdPathParam.and(zExperimentDataQuery))
    .output(zExperimentDataResponse),
  getDistinctColumnValues: oc
    .route({ method: "GET", path: "/api/v1/experiments/{id}/data/distinct", successStatus: 200 })
    .input(zExperimentIdPathParam.and(zExperimentDistinctValuesQuery))
    .output(zExperimentDistinctValuesResponse),
};
