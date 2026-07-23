import { oc } from "@orpc/contract";

import { zGlobalSearchQuery, zGlobalSearchResponse } from "./search.schema";

export const searchContract = {
  globalSearch: oc
    .route({ method: "GET", path: "/api/v1/search", successStatus: 200 })
    .input(zGlobalSearchQuery)
    .output(zGlobalSearchResponse),
};
