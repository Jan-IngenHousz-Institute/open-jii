import { oc } from "@orpc/contract";

import {
  zPublicMetricsResponse,
  zResourceActivityQuery,
  zResourceActivityResponse,
  zScopedMetricsQuery,
  zScopedMetricsResponse,
} from "./metrics.schema";

export const metricsContract = {
  getPublicMetrics: oc
    .route({ method: "GET", path: "/api/v1/metrics/public", successStatus: 200 })
    .output(zPublicMetricsResponse),

  getScopedMetrics: oc
    .route({ method: "GET", path: "/api/v1/metrics/scoped", successStatus: 200 })
    .input(zScopedMetricsQuery)
    .output(zScopedMetricsResponse),

  getResourceActivity: oc
    .route({ method: "GET", path: "/api/v1/metrics/resource-activity", successStatus: 200 })
    .input(zResourceActivityQuery)
    .output(zResourceActivityResponse),
};
