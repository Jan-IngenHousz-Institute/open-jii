import { experimentAccessQueryKey } from "@/hooks/experiment/useExperimentAccess/useExperimentAccess";
import {
  collaboratorsQueryKey,
  granteeOrganizationsQueryKey,
} from "@/hooks/sharing/sharing-query-keys";
import { invitationsQueryKey } from "@/hooks/user-invitation/useUserInvitations/useUserInvitations";
import { createExperimentAccess } from "@/test/factories";
import { renderHook, createTestQueryClient } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { authClient } from "@repo/auth/client";

import { useSignOut } from "./useSignOut";

describe("useSignOut", () => {
  it("signs out and clears session cache", async () => {
    vi.mocked(authClient.signOut).mockResolvedValue({ data: { success: true }, error: null });

    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["auth", "session"], { user: { id: "1" } });

    const { result } = renderHook(() => useSignOut(), { queryClient });
    await result.current.mutateAsync();

    expect(authClient.signOut).toHaveBeenCalled();
    expect(queryClient.getQueryData(["auth", "session"])).toBeNull();
  });

  it("drops every authorization-sensitive cache", async () => {
    vi.mocked(authClient.signOut).mockResolvedValue({ data: { success: true }, error: null });

    const queryClient = createTestQueryClient();
    const grantsKey = collaboratorsQueryKey("user-a", "macro", "macro-1");
    const orgsKey = granteeOrganizationsQueryKey("user-a", undefined);
    const invitationsKey = invitationsQueryKey("user-a", "experiment", "exp-1");
    const accessKey = experimentAccessQueryKey("user-a", "exp-1");
    queryClient.setQueryData(grantsKey, []);
    queryClient.setQueryData(orgsKey, []);
    queryClient.setQueryData(invitationsKey, []);
    queryClient.setQueryData(accessKey, createExperimentAccess({ isAdmin: true }));

    const { result } = renderHook(() => useSignOut(), { queryClient });
    await result.current.mutateAsync();

    // The principal in the key already stops the next user reading these; this
    // makes sure the signed-out user's data does not linger either — invitee
    // emails and resolved capabilities included.
    expect(queryClient.getQueryData(grantsKey)).toBeUndefined();
    expect(queryClient.getQueryData(orgsKey)).toBeUndefined();
    expect(queryClient.getQueryData(invitationsKey)).toBeUndefined();
    expect(queryClient.getQueryData(accessKey)).toBeUndefined();
  });
});
