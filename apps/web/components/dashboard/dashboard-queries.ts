import type { QueryUtils } from "~/lib/orpc";

import type { ListNotificationsQuery } from "@repo/api/domains/notification/notification.schema";
import type { VisitedResourceType } from "@repo/api/domains/visit/visit.schema";

export const RECENTLY_OPENED_LIMIT = 5;

/**
 * Client options for the reads behind the reader's own rows. Access can change between
 * visits, so nothing outlives the home and a row the reader has since lost never shows from
 * an earlier mount's cache. The server's prefetched answer is fresh, hence the stale time.
 */
export const READ_EACH_VISIT = { gcTime: 0, staleTime: 30_000, retry: false };

/** One type's newest visits, or every type's with none given. */
export const recentlyOpenedQuery = (utils: QueryUtils, type?: VisitedResourceType) =>
  utils.visits.listRecentlyOpened.queryOptions({
    input: type ? { type, limit: RECENTLY_OPENED_LIMIT } : { limit: RECENTLY_OPENED_LIMIT },
  });

/** The related experiments that stand in for Recently opened before the first visit. */
export const homeExperimentsQuery = (utils: QueryUtils) =>
  utils.experiments.listHomeExperiments.queryOptions({
    input: { limit: RECENTLY_OPENED_LIMIT },
  });

export const PUBLIC_EXPERIMENTS_PAGE_SIZE = 6;

export const publicExperimentsQuery = (utils: QueryUtils) =>
  utils.experiments.listExperiments.queryOptions({
    input: {
      scope: "all",
      visibility: "public",
      sort: [{ field: "updated", direction: "desc" }],
      page: 1,
      pageSize: PUBLIC_EXPERIMENTS_PAGE_SIZE,
    },
  });

/** The first page of unread notifications; the server prefetches it under the same key. */
export const UNREAD_NOTIFICATIONS_INPUT: ListNotificationsQuery = {
  readState: "unread",
  page: 1,
  pageSize: 5,
};
