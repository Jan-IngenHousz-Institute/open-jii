import { oc } from "@orpc/contract";

import { zExperimentIdPathParam } from "../experiment.schema";
import {
  zColumnDescription,
  zColumnDictionary,
  zColumnIdentityQuery,
  zColumnSuggestion,
  zColumnTermSearchQuery,
  zColumnTermSearchResponse,
  zDescribeColumnBody,
} from "./experiment-columns.schema";

export const experimentColumnsContract = {
  getColumnDictionary: oc
    .route({ method: "GET", path: "/api/v1/experiments/{id}/columns", successStatus: 200 })
    .input(zExperimentIdPathParam)
    .output(zColumnDictionary),
  describeColumn: oc
    .route({
      method: "PUT",
      path: "/api/v1/experiments/{id}/columns/description",
      successStatus: 200,
    })
    .input(zExperimentIdPathParam.merge(zDescribeColumnBody))
    .output(zColumnDescription),
  getColumnSuggestion: oc
    .route({
      method: "GET",
      path: "/api/v1/experiments/{id}/columns/suggestion",
      successStatus: 200,
    })
    .input(zExperimentIdPathParam.merge(zColumnIdentityQuery))
    .output(zColumnSuggestion.nullable()),
  searchColumnTerms: oc
    .route({ method: "GET", path: "/api/v1/column-terms/search", successStatus: 200 })
    .input(zColumnTermSearchQuery)
    .output(zColumnTermSearchResponse),
};
