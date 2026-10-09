import { withPrincipal } from "@/hooks/principal-query-key";
import { orpc } from "@/lib/orpc";
import type { QueryUtils } from "@/lib/orpc";

import type { OrganizationSort } from "@repo/api/domains/organization/organization.schema";
import type { ResourceScope } from "@repo/api/shared/listing";

export interface OrganizationsListView {
  search?: string;
  scope?: ResourceScope;
  sort?: OrganizationSort;
}

/** One view of the organization directory for a person, built the same way for the hook and server. */
export function organizationsListQuery(
  utils: QueryUtils,
  userId: string | undefined,
  view: OrganizationsListView,
) {
  const search = view.search?.trim();
  const input = {
    // An empty box is "no filter", not a search for the empty string.
    search: search === "" ? undefined : search,
    scope: view.scope,
    sort: view.sort?.length ? view.sort : undefined,
  };

  return utils.organizations.listOrganizations.queryOptions({
    input,
    queryKey: withPrincipal(orpc.organizations.listOrganizations.queryKey({ input }), userId),
  });
}
