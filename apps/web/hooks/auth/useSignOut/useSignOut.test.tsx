import { myJoinRequestQueryKey } from "@/hooks/experiment/join-request/useMyJoinRequest/useMyJoinRequest";
import { experimentAccessQueryKey } from "@/hooks/experiment/useExperimentAccess/useExperimentAccess";
import {
  collaboratorsQueryKey,
  granteeOrganizationsQueryKey,
} from "@/hooks/sharing/sharing-query-keys";
import { invitationsQueryKey } from "@/hooks/user-invitation/useUserInvitations/useUserInvitations";
import { orpc } from "@/lib/orpc";
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
    const joinRequestKey = myJoinRequestQueryKey("user-a", "exp-1");
    const deletionBlockersKey = orpc.users.getDeletionBlockers.queryKey({
      input: { id: "user-a" },
    });
    queryClient.setQueryData(grantsKey, []);
    queryClient.setQueryData(orgsKey, []);
    queryClient.setQueryData(invitationsKey, []);
    queryClient.setQueryData(accessKey, createExperimentAccess({ isAdmin: true }));
    queryClient.setQueryData(joinRequestKey, {
      id: "request-a",
      experimentId: "exp-1",
      user: {
        id: "user-a",
        firstName: "User",
        lastName: "A",
        email: "user-a@example.com",
        avatarUrl: null,
      },
      message: null,
      status: "pending",
      decidedBy: null,
      decidedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    queryClient.setQueryData(deletionBlockersKey, { resources: [] });

    const { result } = renderHook(() => useSignOut(), { queryClient });
    await result.current.mutateAsync();

    // The principal in the key already stops the next user reading these; this
    // makes sure the signed-out user's data does not linger either — invitee
    // emails and resolved capabilities included.
    expect(queryClient.getQueryData(grantsKey)).toBeUndefined();
    expect(queryClient.getQueryData(orgsKey)).toBeUndefined();
    expect(queryClient.getQueryData(invitationsKey)).toBeUndefined();
    expect(queryClient.getQueryData(accessKey)).toBeUndefined();
    expect(queryClient.getQueryData(joinRequestKey)).toBeUndefined();
    expect(queryClient.getQueryData(deletionBlockersKey)).toBeUndefined();
  });

  it("drops the resource detail and list caches, which carry no principal at all", async () => {
    vi.mocked(authClient.signOut).mockResolvedValue({ data: { success: true }, error: null });

    const queryClient = createTestQueryClient();
    // Keyed by the resource alone, yet each response carries private content and
    // the asking user's own `capabilities`. Left behind, the next person to sign in
    // on this browser reads them as a settled answer meant for them.
    const detailKeys = [
      orpc.macros.getMacro.queryKey({ input: { id: "macro-1" } }),
      orpc.protocols.getProtocol.queryKey({ input: { id: "protocol-1" } }),
      orpc.workbooks.getWorkbook.queryKey({ input: { id: "workbook-1" } }),
      orpc.iot.getIotDevice.queryKey({ input: { deviceId: "device-1" } }),
      orpc.experiments.getExperiment.queryKey({ input: { id: "exp-1" } }),
    ];
    const listKeys = [
      orpc.macros.listMacros.key(),
      orpc.protocols.listProtocols.key(),
      orpc.workbooks.listWorkbooks.key(),
      orpc.iot.listIotDevices.key(),
      orpc.experiments.listExperiments.key(),
    ];
    for (const key of [...detailKeys, ...listKeys]) {
      queryClient.setQueryData(key, { secret: "user-a only" });
    }

    const { result } = renderHook(() => useSignOut(), { queryClient });
    await result.current.mutateAsync();

    for (const key of [...detailKeys, ...listKeys]) {
      expect(queryClient.getQueryData(key)).toBeUndefined();
    }
  });
});
