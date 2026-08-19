import { orpc } from "@/lib/orpc";
import { createOrganizationJoinRequest } from "@/test/factories";
import { server } from "@/test/msw/server";
import { createTestQueryClient, renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { ORGANIZATION_AUTH_QUERY_KEY } from "../../organization-cache";
import { useDecideOrganizationJoinRequest } from "./useDecideOrganizationJoinRequest";

/**
 * Approving a request writes a membership row, so it has to move everything a
 * membership moves. The Better Auth member-row map is the load-bearing one: it is
 * the only source of the row id a role write addresses, so leaving it cached means a
 * member approved on an already-open screen has no role control at all — and, after
 * a remove-then-rejoin, that a role update can address the deleted row.
 */
describe("useDecideOrganizationJoinRequest", () => {
  const memberRows = [
    ...ORGANIZATION_AUTH_QUERY_KEY,
    "member-rows",
    "org-1",
    { principal: "user-1" },
  ];

  it("invalidates the Better Auth member-row map along with the roster", async () => {
    server.mount(contract.organizations.decideOrganizationJoinRequest, {
      body: createOrganizationJoinRequest({ status: "approved" }),
    });

    const queryClient = createTestQueryClient();
    const seeded: { label: string; queryKey: readonly unknown[] }[] = [
      { label: "member rows", queryKey: memberRows },
      { label: "roster", queryKey: orpc.organizations.listOrganizationMembers.key() },
      { label: "join requests", queryKey: orpc.organizations.listOrganizationJoinRequests.key() },
      { label: "my organizations", queryKey: orpc.organizations.listMyOrganizations.key() },
      // A new member can flip an existing direct grantee from outside collaborator
      // to internal, which the collaborators list renders as a badge.
      { label: "collaborators", queryKey: orpc.sharing.listGrants.key() },
    ];
    for (const { queryKey } of seeded) queryClient.setQueryData(queryKey, { seeded: true });

    const { result } = renderHook(() => useDecideOrganizationJoinRequest(), { queryClient });
    await result.current.mutateAsync({
      id: "org-1",
      requestId: "00000000-0000-0000-0000-0000000000aa",
      decision: "approve",
    });

    await waitFor(() => {
      for (const { label, queryKey } of seeded) {
        expect(queryClient.getQueryState(queryKey)?.isInvalidated, `${label} was left cached`).toBe(
          true,
        );
      }
    });
  });
});
