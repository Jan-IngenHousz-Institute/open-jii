import { render, screen, waitFor, within } from "@/test/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authClient, useSession } from "@repo/auth/client";

import { MyInvitationsCard } from "./my-invitations-card";

const listUserInvitations = () => vi.mocked(authClient.organization.listUserInvitations);

function invitation(overrides: Record<string, unknown> = {}) {
  return {
    id: "invitation-1",
    email: "ada@example.com",
    role: "member",
    organizationId: "org-1",
    organizationName: "Helix Lab",
    inviterId: "user-9",
    status: "pending",
    expiresAt: new Date(Date.now() + 3_600_000),
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("<MyInvitationsCard />", () => {
  beforeEach(() => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "user-a" } },
      isPending: false,
    } as ReturnType<typeof useSession>);
  });

  afterEach(() => {
    vi.mocked(useSession).mockReturnValue({ data: null, isPending: false } as ReturnType<
      typeof useSession
    >);
    listUserInvitations().mockResolvedValue({ data: [], error: null });
  });

  it("lists every waiting invitation with the role it offers", async () => {
    listUserInvitations().mockResolvedValue({
      data: [
        invitation(),
        invitation({ id: "invitation-2", organizationName: "Ridge Lab", role: "admin" }),
      ],
      error: null,
    });

    render(<MyInvitationsCard />);

    const rows = await screen.findAllByTestId("my-invitation-row");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Helix Lab")).toBeVisible();
    expect(within(rows[0]).getByText("organizations.roles.member")).toBeVisible();
    expect(within(rows[1]).getByText("Ridge Lab")).toBeVisible();
    expect(within(rows[1]).getByText("organizations.roles.admin")).toBeVisible();
    expect(
      within(rows[0]).getByRole("button", { name: "organizations.myInvitations.acceptNamed" }),
    ).toBeVisible();
    expect(
      within(rows[0]).getByRole("button", { name: "organizations.myInvitations.declineNamed" }),
    ).toBeVisible();
  });

  /**
   * The one answer that must never be invented: Better Auth turns this endpoint down
   * outright for an address it considers unverified, and an empty list would tell the
   * recipient nobody had invited them.
   */
  it("renders a failed read as a failure rather than as no invitations", async () => {
    listUserInvitations().mockResolvedValue({
      data: null,
      error: { message: "Email verification is required", status: 403 },
    });

    render(<MyInvitationsCard />);

    const error = await screen.findByTestId("my-invitations-error");
    expect(within(error).getByText("organizations.myInvitations.loadError")).toBeVisible();
    expect(
      within(error).getByRole("button", { name: "organizations.myInvitations.retry" }),
    ).toBeVisible();
    expect(screen.queryByText("organizations.myInvitations.empty")).not.toBeInTheDocument();
  });

  /**
   * The empty state carries the wrong-address help this surface used to give from a
   * per-invitation link. Invitations are matched on the signed-in address, so an
   * empty list is genuinely the answer for somebody signed into the wrong account —
   * and the only useful thing to say is why.
   */
  it("says so plainly when nothing is waiting, and why one might be missing", async () => {
    listUserInvitations().mockResolvedValue({ data: [], error: null });

    render(<MyInvitationsCard />);

    expect(await screen.findByText("organizations.myInvitations.empty")).toBeVisible();
    expect(screen.getByText("organizations.myInvitations.emptyHint")).toBeVisible();
    expect(screen.queryByTestId("my-invitations-error")).not.toBeInTheDocument();
  });

  it("accepts an invitation and lands on the organization it just joined", async () => {
    listUserInvitations().mockResolvedValue({ data: [invitation()], error: null });
    vi.mocked(authClient.organization.acceptInvitation).mockResolvedValue({
      data: { member: { organizationId: "org-1" } },
      error: null,
    });

    const { router } = render(<MyInvitationsCard />);

    const accept = await screen.findByRole("button", {
      name: "organizations.myInvitations.acceptNamed",
    });
    accept.click();

    await waitFor(() => {
      expect(vi.mocked(authClient.organization.acceptInvitation)).toHaveBeenCalledWith({
        invitationId: "invitation-1",
      });
    });
    await waitFor(() => {
      expect(vi.mocked(router.push)).toHaveBeenCalledWith("/en-US/platform/organizations/org-1");
    });
  });

  /**
   * Declining is not a departure: the row goes, and whoever has other invitations
   * waiting is left on the tab that holds them rather than sent to a list of the
   * organizations they are not in.
   */
  it("declines without navigating away, and the answered row leaves the list", async () => {
    listUserInvitations()
      .mockResolvedValueOnce({ data: [invitation()], error: null })
      .mockResolvedValue({ data: [], error: null });
    vi.mocked(authClient.organization.rejectInvitation).mockResolvedValue({
      data: { invitation: invitation({ status: "rejected" }) },
      error: null,
    });

    const { router } = render(<MyInvitationsCard />);

    const decline = await screen.findByRole("button", {
      name: "organizations.myInvitations.declineNamed",
    });
    decline.click();

    await waitFor(() => {
      expect(vi.mocked(authClient.organization.rejectInvitation)).toHaveBeenCalledWith({
        invitationId: "invitation-1",
      });
    });
    // The write has to invalidate the recipient's own list, or the row it just
    // retired keeps sitting there offering an Accept that would refuse.
    await waitFor(() => {
      expect(screen.queryAllByTestId("my-invitation-row")).toHaveLength(0);
    });
    expect(vi.mocked(router.push)).not.toHaveBeenCalled();
  });
});
