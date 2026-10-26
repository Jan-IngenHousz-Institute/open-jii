import { oc } from "@orpc/contract";

import { zOrganismSearchQuery, zOrganismSearchResponse } from "./experiment-study.schema";

export const experimentStudyContract = {
  searchOrganisms: oc
    .route({ method: "GET", path: "/api/v1/organisms/search", successStatus: 200 })
    .input(zOrganismSearchQuery)
    .output(zOrganismSearchResponse),
};
