import { oc } from "@orpc/contract";

import { zExperimentIdPathParam } from "../experiment.schema";
import { zExperimentLayout } from "./experiment-layout.schema";

export const experimentLayoutContract = {
  getExperimentLayout: oc
    .route({ method: "GET", path: "/api/v1/experiments/{id}/layout", successStatus: 200 })
    .input(zExperimentIdPathParam)
    .output(zExperimentLayout.nullable()),
};
