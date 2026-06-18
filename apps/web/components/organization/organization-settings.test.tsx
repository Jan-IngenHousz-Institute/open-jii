import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "~/test/test-utils";

import { authClient, useSession } from "@repo/auth/client";

import { OrganizationSettings } from "./organization-settings";

const useActiveOrganization = vi.mocked(authClient.useActiveOrganization);
const getFullOrganization = vi.mocked(authClient.organization.getFullOrganization);
const inviteMember = vi.mocked(authClient.organization.inviteMember);
const removeMember = vi.mocked(authClient.organization.removeMember);

const ORG = { id: "org1", name: "Acme Lab" };

const member = (id: string, userId: string, role: string, email: string, name: string) => ({
  id,
  userId,
  role,
  createdAt: "2024-01-01T00:00:00.000Z",
  user: { id: userId, name, email, image: null },
});

function setUser(userId: string) {
  vi.mocked(useSession).mockReturnValue({
    data: { user: { id: userId } },
  } as ReturnType<typeof useSession>);
}

function setOrg(members: unknown[], invitations: unknown[] = []) {
  getFullOrganization.mockResolvedValue({
    data: { ...ORG, members, invitations },
    error: null,
  } as unknown as ReturnType<typeof getFullOrganization> extends Promise<infer R> ? R : never);
}

describe("OrganizationSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useActiveOrganization.mockReturnValue({
      data: ORG,
      isPending: false,
    } as ReturnType<typeof useActiveOrganization>);
  });

  it("shows members and management controls for an org owner", async () => {
    setUser("u-owner");
    setOrg([
      member("m1", "u-owner", "owner", "ada@example.com", "Ada"),
      member("m2", "u-bob", "member", "bob@example.com", "Bob"),
    ]);

    render(<OrganizationSettings />);

    expect(await screen.findByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();
    expect(screen.getByLabelText("Invite email")).toBeInTheDocument();
    expect(screen.getByLabelText("Role for bob@example.com")).toBeInTheDocument();
    // Can remove others but not self.
    expect(screen.getByLabelText("Remove bob@example.com")).toBeInTheDocument();
    expect(screen.queryByLabelText("Remove ada@example.com")).not.toBeInTheDocument();
  });

  it("invites a member by email", async () => {
    setUser("u-owner");
    setOrg([member("m1", "u-owner", "owner", "ada@example.com", "Ada")]);

    render(<OrganizationSettings />);

    await userEvent.type(await screen.findByLabelText("Invite email"), "new@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Invite" }));

    await waitFor(() => expect(inviteMember).toHaveBeenCalled());
    expect(inviteMember).toHaveBeenCalledWith({
      email: "new@example.com",
      role: "member",
      organizationId: "org1",
    });
  });

  it("hides management controls for a non-admin member", async () => {
    setUser("u-bob");
    setOrg([
      member("m1", "u-owner", "owner", "ada@example.com", "Ada"),
      member("m2", "u-bob", "member", "bob@example.com", "Bob"),
    ]);

    render(<OrganizationSettings />);

    expect(await screen.findByText("ada@example.com")).toBeInTheDocument();
    expect(screen.queryByLabelText("Invite email")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Role for ada@example.com")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Remove/ })).not.toBeInTheDocument();
    expect(removeMember).not.toHaveBeenCalled();
  });
});
