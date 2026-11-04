import { oc } from "@orpc/contract";

import { zExperimentIdPathParam } from "../experiment.schema";
import {
  zExperimentDataQuery,
  zExperimentDataResponse,
  zExperimentDistinctValuesQuery,
  zExperimentDistinctValuesResponse,
  zExperimentTableColumnsQuery,
  zExperimentTableColumnsResponse,
  zExperimentTablesMetadataList,
} from "./experiment-data.schema";
import {
  zExperimentQuestionTypesRequest,
  zExperimentQuestionTypesResponse,
} from "./experiment-question-types.schema";

export const experimentDataContract = {
  getExperimentQuestionTypes: oc
    .route({ method: "POST", path: "/api/v1/experiments/question-types", successStatus: 200 })
    .input(zExperimentQuestionTypesRequest)
    .output(zExperimentQuestionTypesResponse),
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
  getExperimentTableColumns: oc
    .route({ method: "GET", path: "/api/v1/experiments/{id}/data/columns", successStatus: 200 })
    .input(zExperimentIdPathParam.and(zExperimentTableColumnsQuery))
    .output(zExperimentTableColumnsResponse),
};
