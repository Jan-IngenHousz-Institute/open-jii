import { oc } from "@orpc/contract";

import { zHealthTimeResponse } from "./health.contract";

export const healthOrpcContract = {
  getTime: oc
    .route({ method: "GET", path: "/health/time", successStatus: 200 })
    .output(zHealthTimeResponse),
};
