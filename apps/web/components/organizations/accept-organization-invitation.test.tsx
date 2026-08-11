import { render, screen, waitFor } from "@/test/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { authClient, useSession } from "@repo/auth/client";

import { AcceptOrganizationInvitation } from "./accept-organization-invitation";

function mockSession(user: { id: string } | null) {
  vi.mocked(useSession).mockReturnValue({
    data: user ? { user } : null,
    isPending: false,
  } as ReturnType<typeof useSession>);
}

const getInvitation = () => vi.mocked(authClient.organization.getInvitation);

const liveInvitation = {
  id: "invitation-1",
  organizationId: "org-1",
  organizationName: "Greenhouse Lab",
  organizationSlug: "greenhouse-lab",
  email: "ada@example.com",
  inviterEmail: "olive@example.com",
  role: "member",
  status: "pending",
  expiresAt: new Date("2026-12-01T00:00:00.000Z"),
};

describe("<AcceptOrganizationInvitation />", () => {
  afterEach(() => {
    mockSession(null);
    getInvitation().mockResolvedValue({ data: null, error: null });
  });

  it("offers accept and decline for a live invitation", async () => {
    mockSession({ id: "user-1" });
    getInvitation().mockResolvedValue({ data: liveInvitation, error: null });

    render(<AcceptOrganizationInvitation invitationId="invitation-1" />);

    expect(
      await screen.findByRole("button", { name: "organizations.acceptInvitation.acceptAction" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "organizations.acceptInvitation.declineAction" }),
    ).toBeVisible();
  });

  /**
   * A retired, withdrawn or expired invitation answers 400, and Better Auth cannot
   * say which — so one state covers all three, and it cannot name the organization
   * either.
   */
  it("reports a retired invitation as no longer open", async () => {
    mockSession({ id: "user-1" });
    getInvitation().mockResolvedValue({
      data: null,
      error: { message: "Invitation not found!", status: 400 },
    });

    render(<AcceptOrganizationInvitation invitationId="invitation-1" />);

    expect(
      await screen.findByText("organizations.acceptInvitation.unavailableTitle"),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "organizations.acceptInvitation.goToOrganizations" }),
    ).toHaveAttribute("href", "/en-US/platform/organizations");
  });

  /**
   * The distinction the retired state must not swallow: a 403 means the invitation is
   * still live and simply addressed to somebody else. Telling the genuine recipient
   * it no longer exists would send them away from an invitation they can accept.
   */
  it("tells a recipient signed into the wrong account how to switch", async () => {
    mockSession({ id: "user-1" });
    getInvitation().mockResolvedValue({
      data: null,
      error: { message: "You are not the recipient of the invitation", status: 403 },
    });

    render(<AcceptOrganizationInvitation invitationId="invitation-1" />);

    expect(
      await screen.findByText("organizations.acceptInvitation.wrongAccountTitle"),
    ).toBeVisible();
    expect(
      screen.queryByText("organizations.acceptInvitation.unavailableTitle"),
    ).not.toBeInTheDocument();

    // Straight to sign-in, carrying this page as the destination, so accepting is one
    // sign-in away rather than a link the recipient has to find again.
    expect(
      screen.getByRole("link", { name: "organizations.acceptInvitation.switchAccount" }),
    ).toHaveAttribute(
      "href",
      "/en-US/login?callbackUrl=%2Fplatform%2Faccept-invitation%2Finvitation-1",
    );
  });

  it("lands on the organization it just joined", async () => {
    mockSession({ id: "user-1" });
    getInvitation().mockResolvedValue({ data: liveInvitation, error: null });
    vi.mocked(authClient.organization.acceptInvitation).mockResolvedValue({
      data: { invitation: liveInvitation, member: { organizationId: "org-1" } },
      error: null,
    });

    const { router } = render(<AcceptOrganizationInvitation invitationId="invitation-1" />);

    const accept = await screen.findByRole("button", {
      name: "organizations.acceptInvitation.acceptAction",
    });
    accept.click();

    // The membership row names the organization, so there is nothing to re-read.
    await waitFor(() => {
      expect(vi.mocked(router.push)).toHaveBeenCalledWith("/en-US/platform/organizations/org-1");
    });
  });
});
