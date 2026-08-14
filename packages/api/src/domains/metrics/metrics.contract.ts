import { oc } from "@orpc/contract";

import { zPublicMetricsResponse } from "./metrics.schema";

export const metricsContract = {
  getPublicMetrics: oc
    .route({ method: "GET", path: "/api/v1/metrics/public", successStatus: 200 })
    .output(zPublicMetricsResponse),
};
