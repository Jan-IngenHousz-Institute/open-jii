"use client";

import { usePrincipal } from "@/components/auth/principal-context";
import { unwrapAuthResult } from "@/hooks/organization/auth-organization-result";
import { ORGANIZATION_AUTH_QUERY_KEY } from "@/hooks/organization/organization-cache";
import { withPrincipal } from "@/hooks/principal-query-key";
import { useQuery } from "@tanstack/react-query";

import { authClient } from "@repo/auth/client";

/** Better Auth returns at most this many rows when no limit is given, so a larger roster needs pages. */
export const MEMBER_ROWS_PAGE_SIZE = 100;
/** A bound on the loop, not a product limit: far above any real roster. */
const MAX_MEMBER_ROW_PAGES = 200;

async function readPage(organizationId: string, page: number) {
  return unwrapAuthResult(
    await authClient.organization.listMembers({
      query: {
        organizationId,
        limit: MEMBER_ROWS_PAGE_SIZE,
        offset: page * MEMBER_ROWS_PAGE_SIZE,
        // A unique key: members added in one batch share a `createdAt`, and offset
        // paging over a tie can repeat one row and skip another.
        sortBy: "id",
        sortDirection: "asc",
      },
    }),
  );
}

type MemberRowsPage = NonNullable<Awaited<ReturnType<typeof readPage>>>;

/**
 * Every membership row, not only the first page. Demo organizations lift the 100-member
 * cap. A bare `listMembers` call returns only the first 100 rows, so later members
 * would have no row id to change their role or remove them by.
 */
export async function listAllMemberRows(organizationId: string): Promise<MemberRowsPage> {
  const rows = new Map<string, MemberRowsPage["members"][number]>();
  let total = 0;
  for (let page = 0; page < MAX_MEMBER_ROW_PAGES; page += 1) {
    const result = await readPage(organizationId, page);
    if (!result) break;
    total = result.total;
    for (const member of result.members) rows.set(member.id, member);
    if (result.members.length < MEMBER_ROWS_PAGE_SIZE || rows.size >= result.total) break;
  }
  return { members: [...rows.values()], total };
}

export const useOrganizationMemberRows = (
  organizationId: string,
  options?: { enabled?: boolean },
) => {
  const { userId, isPending: isSessionPending } = usePrincipal();

  return useQuery({
    queryKey: withPrincipal(
      [...ORGANIZATION_AUTH_QUERY_KEY, "member-rows", organizationId],
      userId,
    ),
    queryFn: () => listAllMemberRows(organizationId),
    retry: false,
    enabled: (options?.enabled ?? true) && !!organizationId && !isSessionPending,
  });
};
