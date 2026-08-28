"use client";

import { useOrganizations } from "@/hooks/organization/useOrganizations/useOrganizations";
import { useDebounce } from "@/hooks/useDebounce";
import { useUrlState } from "@/hooks/useUrlState";

import type { OrganizationVisibility } from "@repo/api/domains/organization/organization.schema";

export type OrganizationFilter = "my" | "all";

/** One card's worth of organization, whichever slice of the listing produced it. */
export interface OrganizationListItem {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  resourceCount: number;
  visibility: OrganizationVisibility;
  /** Labels the resource count. Derived once here, so `pending_request` is excluded in one place. */
  isMember: boolean;
}

/**
 * The organizations listing: the caller's memberships or the whole directory, chosen by
 * a filter the URL carries — the same `?filter=all` the experiments and macros use.
 *
 * One endpoint serves both, the filter riding along as `scope`. It used to be two reads,
 * the memberships filtered here by substring, so "my" missed location, type, stemming
 * and typos that "all" found. Personal workspaces are excluded server-side.
 */
export function useOrganizationsList() {
  const [filter, setFilter] = useUrlState<OrganizationFilter>({
    key: "filter",
    serialize: (value) => (value === "all" ? "all" : null),
    parse: (raw) => (raw === "all" ? "all" : "my"),
  });
  const [search, setSearch] = useUrlState<string>({
    key: "q",
    serialize: (value) => (value === "" ? null : value),
    parse: (raw) => raw ?? "",
  });
  const [debouncedSearch, isDebounced] = useDebounce(search);

  const isMine = filter === "my";

  const directory = useOrganizations({
    search: debouncedSearch,
    scope: isMine ? "related" : "all",
  });

  const organizations: OrganizationListItem[] = (directory.data?.organizations ?? []).map(
    (organization) => ({
      id: organization.id,
      name: organization.name,
      description: organization.description,
      memberCount: organization.memberCount,
      resourceCount: organization.resourceCount,
      // Read from the row, not assumed: the directory carries the caller's own private
      // organizations, so hardcoding "public" here would strip their badge.
      visibility: organization.visibility,
      // `pending_request` is not membership.
      isMember: organization.membershipStatus === "member",
    }),
  );

  return {
    filter,
    setFilter,
    search,
    setSearch,
    /** The search box's own spinner: a pending term, or the request it triggered. */
    isSearching: !isDebounced || directory.isFetching,
    debouncedSearch,
    organizations,
    isPending: directory.isPending,
    isError: directory.isError,
    isFetching: directory.isFetching,
  };
}
