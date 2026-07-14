import { initContract } from "@ts-rest/core";

import {
  zGlobalSearchQuery,
  zGlobalSearchResponse,
  zSearchErrorResponse,
} from "../schemas/search.schema";

const c = initContract();

export const searchContract = c.router({
  globalSearch: {
    method: "GET",
    path: "/api/v1/search",
    query: zGlobalSearchQuery,
    responses: {
      200: zGlobalSearchResponse,
      400: zSearchErrorResponse,
    },
    summary: "Global cross-entity search",
    description:
      "Relevance-ranked full-text + fuzzy search across experiments, protocols, macros and workbooks.",
  },
});
