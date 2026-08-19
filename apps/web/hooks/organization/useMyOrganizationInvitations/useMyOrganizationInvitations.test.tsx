import { myOrganizationInvitationsQueryKey } from "@/hooks/organization/organization-cache";
import { createTestQueryClient, renderHook, waitFor } from "@/test/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { authClient, useSession } from "@repo/auth/client";

import { useMyOrganizationInvitations } from "./useMyOrganizationInvitations";

function mockSession(userId: string | null, isPending = false) {
  vi.mocked(useSession).mockReturnValue({
    data: userId === null ? null : { user: { id: userId } },
    isPending,
  } as ReturnType<typeof useSession>);
}

const listUserInvitations = () => vi.mocked(authClient.organization.listUserInvitations);

const hourFromNow = () => new Date(Date.now() + 3_600_000);
const hourAgo = () => new Date(Date.now() - 3_600_000);

const helix = {
  id: "invitation-1",
  email: "ada@example.com",
  role: "member",
  organizationId: "org-1",
  organizationName: "Helix Lab",
  inviterId: "user-9",
  status: "pending",
  expiresAt: hourFromNow(),
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
};

describe("useMyOrganizationInvitations", () => {
  afterEach(() => {
    mockSession(null);
    listUserInvitations().mockResolvedValue({ data: [], error: null });
  });

  it("returns the invitations waiting for the signed-in account", async () => {
    mockSession("user-a");
    listUserInvitations().mockResolvedValue({ data: [helix], error: null });

    const { result } = renderHook(() => useMyOrganizationInvitations());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual([helix]);
    // No input: Better Auth answers for the session's own address and refuses to be
    // handed another, so passing one would fail the request outright.
    expect(listUserInvitations()).toHaveBeenCalledWith();
  });

  /**
   * Better Auth filters to `status === "pending"` and stops there, and it never
   * retires an expired invitation's stored status — so a past-due row comes back
   * looking live. Offering it would produce an Accept that can only fail.
   */
  it("drops an invitation that is past its expiry", async () => {
    mockSession("user-a");
    listUserInvitations().mockResolvedValue({
      data: [helix, { ...helix, id: "invitation-2", expiresAt: hourAgo() }],
      error: null,
    });

    const { result } = renderHook(() => useMyOrganizationInvitations());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual([helix]);
  });

  it("waits for the session rather than asking as nobody", async () => {
    mockSession(null, true);

    const { result } = renderHook(() => useMyOrganizationInvitations());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(listUserInvitations()).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });

  /**
   * The QueryClient is module-level and survives a client-side sign-out, so a key
   * built from the (absent) inputs alone would hand the next user the previous one's
   * invitations as a settled `success`.
   */
  it("scopes the cache to the principal", async () => {
    // One QueryClient across both, as in the app: it is module-level and survives a
    // client-side sign-out → sign-in.
    const queryClient = createTestQueryClient();
    mockSession("user-a");
    listUserInvitations().mockResolvedValue({ data: [helix], error: null });

    const { result, rerender } = renderHook(() => useMyOrganizationInvitations(), { queryClient });
    await waitFor(() => {
      expect(result.current.data).toEqual([helix]);
    });
    expect(queryClient.getQueryData(myOrganizationInvitationsQueryKey("user-a"))).toEqual([helix]);

    mockSession("user-b");
    listUserInvitations().mockResolvedValue({ data: [], error: null });
    rerender();

    // A key built from the (absent) inputs alone would hand user-b the previous
    // user's invitations as a settled `success`.
    await waitFor(() => {
      expect(result.current.data).toEqual([]);
    });
    expect(queryClient.getQueryData(myOrganizationInvitationsQueryKey("user-b"))).toEqual([]);
  });

  /**
   * A refusal is an answer. Better Auth turns this endpoint down for an address it
   * considers unverified whatever `requireEmailVerificationOnInvitation` says, and a
   * retried 403 would only spend requests on the same verdict.
   */
  it("surfaces a refusal as an error and does not retry it", async () => {
    mockSession("user-a");
    listUserInvitations().mockResolvedValue({
      data: null,
      error: { message: "Email verification is required", status: 403 },
    });

    const { result } = renderHook(() => useMyOrganizationInvitations());

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    // Never a list — the caller has to be able to tell "no invitations" from
    // "could not ask".
    expect(result.current.data).toBeUndefined();
    expect(listUserInvitations()).toHaveBeenCalledTimes(1);
  });

  it("skips the request entirely when disabled", async () => {
    mockSession("user-a");

    const { result } = renderHook(() => useMyOrganizationInvitations({ enabled: false }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(listUserInvitations()).not.toHaveBeenCalled();
  });
});
