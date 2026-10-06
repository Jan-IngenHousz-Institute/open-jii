import { oc } from "@orpc/contract";
import { z } from "zod";

import { zRecordVisitBody } from "./visit.schema";

export const visitContract = {
  recordVisit: oc
    .route({ method: "POST", path: "/api/v1/visits", successStatus: 204 })
    .input(zRecordVisitBody)
    .output(z.void()),
};
