import { oc } from "@orpc/contract";
import { z } from "zod";

import { zRecentlyOpened, zRecentlyOpenedQuery, zRecordVisitBody } from "./visit.schema";

export const visitContract = {
  recordVisit: oc
    .route({ method: "POST", path: "/api/v1/visits", successStatus: 204 })
    .input(zRecordVisitBody)
    .output(z.void()),
  listRecentlyOpened: oc
    .route({ method: "GET", path: "/api/v1/recently-opened", successStatus: 200 })
    .input(zRecentlyOpenedQuery)
    .output(zRecentlyOpened),
};
