import { oc } from "@orpc/contract";

import {
  zExperimentListUploadsQuery,
  zExperimentListUploadsResponse,
} from "./experiment-uploads.schema";
import { zExperimentIdPathParam } from "./experiment.schema";

export const experimentUploadsOrpcContract = {
  listUploads: oc
    .route({ method: "GET", path: "/api/v1/experiments/{id}/data/uploads", successStatus: 200 })
    .input(zExperimentIdPathParam.and(zExperimentListUploadsQuery))
    .output(zExperimentListUploadsResponse),
};
