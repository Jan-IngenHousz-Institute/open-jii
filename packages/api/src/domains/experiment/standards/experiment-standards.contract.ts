import { oc } from "@orpc/contract";

import { zExperimentIdPathParam } from "../experiment.schema";
import {
  zExperimentStandards,
  zStandardFields,
  zStandardFieldsPathParam,
  zUpdateFollowedStandardsBody,
} from "./experiment-standards.schema";

export const experimentStandardsContract = {
  getExperimentStandards: oc
    .route({ method: "GET", path: "/api/v1/experiments/{id}/standards", successStatus: 200 })
    .input(zExperimentIdPathParam)
    .output(zExperimentStandards),
  updateFollowedStandards: oc
    .route({
      method: "PUT",
      path: "/api/v1/experiments/{id}/standards/followed",
      successStatus: 200,
    })
    .input(zExperimentIdPathParam.merge(zUpdateFollowedStandardsBody))
    .output(zUpdateFollowedStandardsBody),
  getExperimentStandardFields: oc
    .route({
      method: "GET",
      path: "/api/v1/experiments/{id}/standards/{standard}/fields",
      successStatus: 200,
    })
    .input(zStandardFieldsPathParam)
    .output(zStandardFields),
};
