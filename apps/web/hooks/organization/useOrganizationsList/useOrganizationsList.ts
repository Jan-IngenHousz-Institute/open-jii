"use client";

import { useMyOrganizations } from "@/hooks/organization/useMyOrganizations/useMyOrganizations";
import { useOrganizations } from "@/hooks/organization/useOrganizations/useOrganizations";
import { useDebounce } from "@/hooks/useDebounce";
import { useUrlState } from "@/hooks/useUrlState";

import type { OrganizationVisibility } from "@repo/api/domains/organization/organization.schema";

export type OrganizationFilter = "my" | "all";

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
 * selected one is fetched. Both come back whole — neither is paged — so "all" means
 * all. The directory searches server-side; the memberships are already fetched
 * complete for the picker on every create form, so searching them here costs no round
 * trip and no second cache entry per keystroke.
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

  const mine = useMyOrganizations({ enabled: isMine });
  const directory = useOrganizations({ search: debouncedSearch }, { enabled: !isMine });

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
      // Read from the row, not assumed: the directory now carries the caller's own
      // private organizations, so hardcoding "public" here would strip their badge.
      visibility: organization.visibility,
    }),
  );

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
    isFetching: directory.isFetching,
  };
}
