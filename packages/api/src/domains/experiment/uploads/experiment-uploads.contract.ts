import { oc } from "@orpc/contract";

import { zExperimentIdPathParam } from "../experiment.schema";
import {
  zExperimentListUploadsQuery,
  zExperimentListUploadsResponse,
} from "./experiment-uploads.schema";

export const experimentUploadsContract = {
  listUploads: oc
    .route({ method: "GET", path: "/api/v1/experiments/{id}/data/uploads", successStatus: 200 })
    .input(zExperimentIdPathParam.and(zExperimentListUploadsQuery))
    .output(zExperimentListUploadsResponse),
};
