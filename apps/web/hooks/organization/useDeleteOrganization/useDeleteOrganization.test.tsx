import { orpc } from "@/lib/orpc";
import { createTestQueryClient, renderHook, waitFor } from "@/test/test-utils";
import type { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { authClient } from "@repo/auth/client";

import { ORGANIZATION_AUTH_QUERY_KEY } from "../organization-cache";
import { useDeleteOrganization } from "./useDeleteOrganization";

const deleteOrganization = () => vi.mocked(authClient.organization.delete);

/**
 * Deleting an organization tears down, server-side, the grants it and its teams
 * held — so anything already cached about it has to be re-read, not just the
 * organization lists. Asserted through a real QueryClient rather than by inspecting
 * the hook's key list, so the prefix matching React Query actually does is what is
 * being pinned.
 */
function seed(queryClient: QueryClient) {
  const entries: { label: string; queryKey: readonly unknown[] }[] = [
    { label: "collaborators", queryKey: orpc.sharing.listGrants.key() },
    { label: "grantee teams", queryKey: orpc.organizations.listGranteeTeams.key() },
    { label: "organization teams", queryKey: orpc.organizations.listOrganizationTeams.key() },
    { label: "my organizations", queryKey: orpc.organizations.listMyOrganizations.key() },
    { label: "directory", queryKey: orpc.organizations.listOrganizations.key() },
    {
      label: "deletion blockers",
      queryKey: orpc.organizations.getOrganizationDeletionBlockers.key(),
    },
    {
      label: "pending invitations",
      queryKey: [...ORGANIZATION_AUTH_QUERY_KEY, "invitations", "org-1", { principal: "user-1" }],
    },
    {
      label: "member rows",
      queryKey: [...ORGANIZATION_AUTH_QUERY_KEY, "member-rows", "org-1", { principal: "user-1" }],
    },
  ];

  for (const { queryKey } of entries) {
    queryClient.setQueryData(queryKey, { seeded: true });
  }

  return entries;
}

describe("useDeleteOrganization", () => {
  afterEach(() => {
    deleteOrganization().mockResolvedValue({ data: null, error: null });
  });

  it("invalidates everything the deleted organization was cached in", async () => {
    const queryClient = createTestQueryClient();
    const entries = seed(queryClient);

    const { result } = renderHook(() => useDeleteOrganization(), { queryClient });
    await result.current.mutateAsync({ organizationId: "org-1" });

    await waitFor(() => {
      for (const { label, queryKey } of entries) {
        const state = queryClient.getQueryState(queryKey);
        expect(state?.isInvalidated, `${label} was left cached`).toBe(true);
      }
    });
  });

  it("passes the organization id Better Auth deletes by", async () => {
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useDeleteOrganization(), { queryClient });
    await result.current.mutateAsync({ organizationId: "org-1" });

    expect(deleteOrganization()).toHaveBeenCalledWith({ organizationId: "org-1" });
  });

  it("rejects with the server's refusal rather than resolving quietly", async () => {
    deleteOrganization().mockResolvedValue({
      data: null,
      error: { message: "This organization still owns 2 resources (2 devices)." },
    });
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useDeleteOrganization(), { queryClient });

    // Better Auth's client resolves an envelope; React Query needs a rejection for
    // the danger zone to surface the reason at all.
    await expect(result.current.mutateAsync({ organizationId: "org-1" })).rejects.toThrow(
      /still owns 2 resources/,
    );
  });
});
