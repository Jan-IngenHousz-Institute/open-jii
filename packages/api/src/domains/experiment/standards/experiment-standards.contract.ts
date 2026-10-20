import { oc } from "@orpc/contract";

import { zExperimentIdPathParam } from "../experiment.schema";
import {
  zExperimentStandardsReadiness,
  zStandardFields,
  zStandardFieldsPathParam,
} from "./experiment-standards.schema";

export const experimentStandardsContract = {
  getExperimentStandardsReadiness: oc
    .route({ method: "GET", path: "/api/v1/experiments/{id}/standards", successStatus: 200 })
    .input(zExperimentIdPathParam)
    .output(zExperimentStandardsReadiness),
  getExperimentStandardFields: oc
    .route({
      method: "GET",
      path: "/api/v1/experiments/{id}/standards/{standard}/fields",
      successStatus: 200,
    })
    .input(zStandardFieldsPathParam)
    .output(zStandardFields),
};
