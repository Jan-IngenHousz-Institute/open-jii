import { oc } from "@orpc/contract";

import { zExperimentIdPathParam } from "../experiment.schema";
import {
  zOrganismSearchQuery,
  zOrganismSearchResponse,
  zStudyRecord,
} from "./experiment-study.schema";

export const experimentStudyContract = {
  searchOrganisms: oc
    .route({ method: "GET", path: "/api/v1/organisms/search", successStatus: 200 })
    .input(zOrganismSearchQuery)
    .output(zOrganismSearchResponse),
  getStudyRecord: oc
    .route({ method: "GET", path: "/api/v1/experiments/{id}/study-record", successStatus: 200 })
    .input(zExperimentIdPathParam)
    .output(zStudyRecord),
};
