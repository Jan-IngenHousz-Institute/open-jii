import { initContract } from "@ts-rest/core";

import { zFeedItemList, zFeedQuery } from "../schemas/feed.schema";

const c = initContract();

/**
 * The personal activity feed for the platform dashboard: a recency-ordered,
 * non-isolated stream of everything you can reach across all your organizations
 * (your resources + your orgs' resources + things shared with you) plus org
 * membership events. Built from existing resource/membership timestamps.
 */
export const feedContract = c.router({
  getFeed: {
    method: "GET",
    path: "/api/v1/feed",
    query: zFeedQuery,
    responses: {
      200: zFeedItemList,
    },
    summary: "Personal activity feed",
    description:
      "Recency-ordered activity across every organization you belong to, plus your " +
      "own and shared-with-you resources. Not scoped to the active organization.",
  },
});
