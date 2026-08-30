import { oc } from "@orpc/contract";

import {
  zPublicMetricsResponse,
  zResourceMetricsQuery,
  zResourceMetricsResponse,
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

  getResourceMetrics: oc
    .route({ method: "GET", path: "/api/v1/metrics/resource-metrics", successStatus: 200 })
    .input(zResourceMetricsQuery)
    .output(zResourceMetricsResponse),
};
