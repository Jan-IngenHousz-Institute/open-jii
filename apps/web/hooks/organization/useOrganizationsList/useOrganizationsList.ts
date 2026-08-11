"use client";

import { useMyOrganizations } from "@/hooks/organization/useMyOrganizations/useMyOrganizations";
import { useOrganizations } from "@/hooks/organization/useOrganizations/useOrganizations";
import { useDebounce } from "@/hooks/useDebounce";
import { useUrlState } from "@/hooks/useUrlState";
import { useEffect } from "react";

import type { OrganizationVisibility } from "@repo/api/domains/organization/organization.schema";

export type OrganizationFilter = "my" | "all";

/** How many directory rows one page holds. */
export const ORGANIZATIONS_PAGE_SIZE = 20;

/** One card's worth of organization, whichever of the two reads produced it. */
export interface OrganizationListItem {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  resourceCount: number;
  visibility: OrganizationVisibility;
}

function matches(organization: OrganizationListItem, term: string): boolean {
  const needle = term.trim().toLowerCase();
  if (needle === "") return true;

  return (
    organization.name.toLowerCase().includes(needle) ||
    (organization.description ?? "").toLowerCase().includes(needle)
  );
}

/**
 * The organizations listing: the caller's memberships or the public directory,
 * chosen by a filter the URL carries — the same `?filter=all` the experiments and
 * macros listings use.
 *
 * The two states are two endpoints rather than one filtered read, so only the
 * selected one is fetched. The directory searches and pages server-side; the
 * memberships come back whole — the picker on every create form already needs the
 * complete list — so searching them here costs no round trip and no second cache
 * entry per keystroke.
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
  const [page, setPage] = useUrlState<number>({
    key: "page",
    serialize: (value) => (value === 1 ? null : String(value)),
    parse: (raw) => {
      const parsed = Number(raw);
      return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
    },
  });

  const [debouncedSearch, isDebounced] = useDebounce(search);

  // A new search or a new filter invalidates the page number: page 4 of the
  // previous result set says nothing about this one, and would show an empty list
  // on a real match.
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setPage is stable per the hook's contract; re-running on it would fight the URL sync.
  }, [debouncedSearch, filter]);

  const isMine = filter === "my";
  const offset = (page - 1) * ORGANIZATIONS_PAGE_SIZE;

  const mine = useMyOrganizations({ enabled: isMine });
  const directory = useOrganizations(
    { search: debouncedSearch, limit: ORGANIZATIONS_PAGE_SIZE, offset },
    { enabled: !isMine },
  );

  // Personal workspaces are absent: the endpoint returns them — the resource create
  // pickers need one as their default target — but they are not organizations in
  // product terms, so nothing about them is manageable and listing one here would
  // offer management it lacks.
  const myOrganizations: OrganizationListItem[] = (mine.data ?? [])
    .filter((organization) => !organization.isPersonal)
    .map((organization) => ({
      id: organization.id,
      name: organization.name,
      description: organization.description,
      memberCount: organization.memberCount,
      resourceCount: organization.resourceCount,
      visibility: organization.visibility,
    }))
    .filter((organization) => matches(organization, debouncedSearch));

  const directoryOrganizations: OrganizationListItem[] = (directory.data?.organizations ?? []).map(
    (organization) => ({
      id: organization.id,
      name: organization.name,
      description: organization.description,
      memberCount: organization.memberCount,
      resourceCount: organization.resourceCount,
      // A directory row is a listed organization by construction; the read has no
      // visibility column because there is only one value it could carry.
      visibility: "public" as const,
    }),
  );

  const total = directory.data?.total ?? 0;

  return {
    filter,
    setFilter,
    search,
    setSearch,
    /** The search box's own spinner: a pending term, or the request it triggered. */
    isSearching: !isDebounced || (!isMine && directory.isFetching),
    debouncedSearch,
    organizations: isMine ? myOrganizations : directoryOrganizations,
    isPending: isMine ? mine.isPending : directory.isPending,
    isError: isMine ? mine.isError : directory.isError,
    /** Paging belongs to the directory read; the memberships come back whole. */
    isPaged: !isMine,
    isFetching: directory.isFetching,
    page,
    setPage,
    offset,
    total,
    isLastPage: offset + directoryOrganizations.length >= total,
  };
}
