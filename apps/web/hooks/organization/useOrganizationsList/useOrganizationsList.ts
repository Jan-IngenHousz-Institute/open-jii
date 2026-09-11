"use client";

import { useOrganizations } from "@/hooks/organization/useOrganizations/useOrganizations";
import { useDebounce } from "@/hooks/useDebounce";
import { useSearchPending } from "@/hooks/useSearchPending";
import { useUrlState } from "@/hooks/useUrlState";
import { useEffect, useState } from "react";

import type { OrganizationVisibility } from "@repo/api/domains/organization/organization.schema";

/** One organization row, whichever slice of the listing produced it. */
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

const PAGE_SIZE = 20;

/**
 * One ownership-ranked organization directory. The server returns the caller's
 * organizations first, followed by the rest of the searchable public directory.
 * Personal workspaces are excluded server-side.
 */
export function useOrganizationsList() {
  const [search, setSearchState] = useUrlState<string>({
    key: "q",
    serialize: (value) => (value === "" ? null : value),
    parse: (raw) => raw ?? "",
  });
  const [page, setPage] = useState(1);
  const [debouncedSearch] = useDebounce(search);

  const setSearch = (value: string) => {
    setSearchState(value);
    setPage(1);
  };

  const directory = useOrganizations({
    search: debouncedSearch,
    scope: "all",
  });
  const isSearchPending = useSearchPending({
    search,
    debouncedSearch,
    isFetching: directory.isFetching,
  });

  const allOrganizations: OrganizationListItem[] = (directory.data?.organizations ?? []).map(
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
  const totalPages = Math.max(1, Math.ceil(allOrganizations.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const organizations = allOrganizations.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return {
    search,
    setSearch,
    /** The search box's own spinner: a pending term, or the request it triggered. */
    isSearching: isSearchPending,
    debouncedSearch,
    organizations,
    isPending: directory.isPending,
    isPlaceholderData: directory.isPlaceholderData,
    isError: directory.isError,
    error: directory.error,
    refetch: directory.refetch,
    isFetching: directory.isFetching,
    page: currentPage,
    totalPages,
    setPage,
  };
}
