import { oc } from "@orpc/contract";

import { zExperimentIdPathParam } from "../experiment.schema";
import { zExperimentContributorList } from "./experiment-contributors.schema";

export const experimentContributorsContract = {
  listExperimentContributors: oc
    .route({ method: "GET", path: "/api/v1/experiments/{id}/contributors", successStatus: 200 })
    .input(zExperimentIdPathParam)
    .output(zExperimentContributorList),
};
