"use client";

import { usePrincipal } from "@/components/auth/principal-context";
import { organizationsListQuery } from "@/hooks/organization/useOrganizations/organizations-list-query";
import { ANONYMOUS_PRINCIPAL } from "@/hooks/principal-query-key";
import { useResourceList } from "@/hooks/useResourceList";
import { orpc } from "@/lib/orpc";

import {
  zOrganizationSort,
  zOrganizationType,
} from "@repo/api/domains/organization/organization.schema";
import type {
  OrganizationDirectory,
  OrganizationType,
  OrganizationVisibility,
} from "@repo/api/domains/organization/organization.schema";

/** One organization row, whichever slice of the listing produced it. */
export interface OrganizationListItem {
  id: string;
  name: string;
  description: string | null;
  type: OrganizationType | null;
  memberCount: number;
  resourceCount: number;
  visibility: OrganizationVisibility;
  /** Labels the resource count. Derived once here, so `pending_request` is excluded in one place. */
  isMember: boolean;
}

const ORGANIZATION_LIST_FILTERS = { type: zOrganizationType };

/**
 * The organization directory: public organizations plus the caller's own private ones,
 * searched, filtered and sorted on the server and paged 20 at a time in the browser.
 * Without search or explicit sorting, the server ranks the caller's owned organizations
 * first, then joined ones, then the public directory. Search (`q`), sort and types live
 * in the URL.
 *
 * Both the row set and each row's membership depend on the caller, so the cache is
 * principal-scoped: a module-level QueryClient survives sign-out, and the next user must
 * not inherit the previous one's directory or join state.
 */
export function useOrganizationsList() {
  const { userId, isPending: isSessionPending } = usePrincipal();
  const principal = userId ?? ANONYMOUS_PRINCIPAL;

  return useResourceList({
    filters: ORGANIZATION_LIST_FILTERS,
    sort: zOrganizationSort,
    searchKey: "q",
    query: (view) => ({
      ...organizationsListQuery(orpc, userId, {
        search: view.search,
        scope: "all",
        sort: view.sort,
        types: view.filters.type,
      }),
      meta: { principal },
      // A new search term is a new cache key, and without this the list would fall back
      // to its pending state, unmounting every row, including a join dialog the reader
      // had open. Rows from another person's session are never shown.
      placeholderData: (
        previous: OrganizationDirectory | undefined,
        previousQuery?: { meta?: Record<string, unknown> },
      ) => (previousQuery?.meta?.principal === principal ? previous : undefined),
      enabled: !isSessionPending,
      select: (data: OrganizationDirectory): OrganizationListItem[] =>
        data.organizations.map((organization) => ({
          id: organization.id,
          name: organization.name,
          description: organization.description,
          type: organization.type,
          memberCount: organization.memberCount,
          resourceCount: organization.resourceCount,
          // Read from the row, not assumed: the directory carries the caller's own private
          // organizations, so hardcoding "public" here would strip their badge.
          visibility: organization.visibility,
          // `pending_request` is not membership.
          isMember: organization.membershipStatus === "member",
        })),
    }),
  });
}
