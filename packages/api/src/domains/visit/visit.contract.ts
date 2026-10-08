import { oc } from "@orpc/contract";
import { z } from "zod";

import { zRecordExperimentVisitPath } from "./visit.schema";

export const visitContract = {
  recordExperimentVisit: oc
    .route({ method: "POST", path: "/api/v1/experiments/{id}/visits", successStatus: 204 })
    .input(zRecordExperimentVisitPath)
    .output(z.void()),
};
