import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authClient, useSession } from "@repo/auth/client";

import { NotificationInvitationsSection } from "./notification-invitations-section";

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

describe("<NotificationInvitationsSection />", () => {
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

  it("lists each waiting invitation with its role, linking to the Invitations tab", async () => {
    listUserInvitations().mockResolvedValue({
      data: [
        invitation(),
        invitation({ id: "invitation-2", organizationName: "Ridge Lab", role: "admin" }),
      ],
      error: null,
    });

    render(<NotificationInvitationsSection onNavigate={vi.fn()} />);

    const section = await screen.findByTestId("bell-invitations");
    // The role shares a line with its caption, so match the key inside the text.
    expect(within(section).getByText("Helix Lab")).toBeVisible();
    expect(within(section).getByText(/organizations\.roles\.member/)).toBeVisible();
    expect(within(section).getByText("Ridge Lab")).toBeVisible();
    expect(within(section).getByText(/organizations\.roles\.admin/)).toBeVisible();
    const links = within(section).getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/en-US/platform/account/invitations");
  });

  it("calls back when an invitation is opened, so the bell can close", async () => {
    const onNavigate = vi.fn();
    listUserInvitations().mockResolvedValue({ data: [invitation()], error: null });
    const user = userEvent.setup();

    render(<NotificationInvitationsSection onNavigate={onNavigate} />);

    await user.click(await screen.findByText("Helix Lab"));

    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when there is no invitation to answer", async () => {
    listUserInvitations().mockResolvedValue({ data: [], error: null });

    render(<NotificationInvitationsSection onNavigate={vi.fn()} />);

    await waitFor(() => expect(listUserInvitations()).toHaveBeenCalled());
    expect(screen.queryByTestId("bell-invitations")).not.toBeInTheDocument();
  });

  it("shows a refusal as a failure with a retry, never as an empty list", async () => {
    listUserInvitations().mockResolvedValueOnce({
      data: null,
      error: { message: "Forbidden", code: "FORBIDDEN", status: 403 },
    });
    listUserInvitations().mockResolvedValueOnce({ data: [invitation()], error: null });
    const user = userEvent.setup();

    render(<NotificationInvitationsSection onNavigate={vi.fn()} />);

    const error = await screen.findByTestId("bell-invitations-error");
    expect(within(error).getByText("organizations.myInvitations.loadError")).toBeVisible();

    await user.click(
      within(error).getByRole("button", { name: "organizations.myInvitations.retry" }),
    );

    expect(await screen.findByText("Helix Lab")).toBeVisible();
  });
});
